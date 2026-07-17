import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CATEGORIES } from "./knowledge.server";

const CategorySchema = z.enum(CATEGORIES);

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_documents")
      .select("id, file_name, file_type, file_size, category, status, status_error, uploaded_at, storage_path")
      .order("uploaded_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: doc, error }, { data: sources }] = await Promise.all([
      context.supabase.from("knowledge_documents").select("*").eq("id", data.documentId).maybeSingle(),
      context.supabase
        .from("deliverable_sources")
        .select("agent_task_id, agent_tasks(agent_id, deliverable_title, project_id, updated_at)")
        .eq("document_id", data.documentId),
    ]);
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Document not found");
    let signedUrl: string | null = null;
    const { data: signed } = await context.supabase.storage
      .from("business-documents")
      .createSignedUrl(doc.storage_path, 60 * 30);
    signedUrl = signed?.signedUrl ?? null;
    return { document: doc, sources: sources ?? [], signedUrl };
  });

export const ingestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        storagePath: z.string(),
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        category: CategorySchema,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    // Verify the storage path belongs to the caller
    if (!data.storagePath.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid storage path");
    }

    const { data: doc, error: insertErr } = await context.supabase
      .from("knowledge_documents")
      .insert({
        user_id: context.userId,
        storage_path: data.storagePath,
        file_name: data.fileName,
        file_type: data.fileType,
        file_size: data.fileSize,
        category: data.category,
        status: "processing",
      })
      .select()
      .single();
    if (insertErr) throw new Error(insertErr.message);

    // Fire-and-await ingestion inline (small files, cap 20MB)
    await processDocument(context.supabase, doc.id);
    return { documentId: doc.id as string };
  });

export const reprocessDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("knowledge_documents")
      .update({ status: "processing", status_error: null })
      .eq("id", data.documentId);
    await context.supabase.from("document_chunks").delete().eq("document_id", data.documentId);
    await processDocument(context.supabase, data.documentId);
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("knowledge_documents")
      .select("storage_path")
      .eq("id", data.documentId)
      .maybeSingle();
    if (doc) {
      await context.supabase.storage.from("business-documents").remove([doc.storage_path]);
    }
    await context.supabase.from("knowledge_documents").delete().eq("id", data.documentId);
    return { ok: true };
  });

async function processDocument(supabase: any, documentId: string) {
  const { extractText, chunkText } = await import("./knowledge.server");
  const { embedText } = await import("./ai-gateway.server");

  const { data: doc, error: fetchErr } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (fetchErr || !doc) return;

  try {
    const { data: file, error: dlErr } = await supabase.storage
      .from("business-documents")
      .download(doc.storage_path);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Download failed");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { text, extractable } = await extractText(bytes, doc.file_type, doc.file_name);

    if (!extractable) {
      await supabase
        .from("knowledge_documents")
        .update({ status: "indexed", extracted_text: null })
        .eq("id", documentId);
      return;
    }
    if (!text) throw new Error("No text found in document");

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("Nothing to index after chunking");

    // Embed sequentially — provider caps and quotas
    const rows: any[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const emb = await embedText(chunks[i]);
      rows.push({
        document_id: documentId,
        chunk_index: i,
        chunk_text: chunks[i],
        embedding: emb as any,
      });
    }
    await supabase.from("document_chunks").insert(rows);

    await supabase
      .from("knowledge_documents")
      .update({
        status: "indexed",
        extracted_text: text.slice(0, 20000),
        status_error: null,
      })
      .eq("id", documentId);
  } catch (err) {
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", status_error: (err as Error).message.slice(0, 500) })
      .eq("id", documentId);
  }
}
