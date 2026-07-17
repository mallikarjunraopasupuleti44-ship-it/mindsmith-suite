import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Upload, FileText, Trash2, RefreshCw, Search, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listDocuments, ingestDocument, deleteDocument, reprocessDocument, getDocument,
} from "@/lib/knowledge.functions";
import { CATEGORIES, type Category } from "@/lib/knowledge.server";

export const Route = createFileRoute("/_authenticated/dashboard/knowledge")({
  component: KnowledgePage,
});

const CATEGORY_LABELS: Record<Category, string> = {
  financial: "Financial",
  marketing: "Marketing & Brand",
  operations: "Operations",
  legal: "Legal",
  other: "Other",
};

const CATEGORY_HELP: Record<Category, string> = {
  financial: "P&L, budgets, pricing — used by the Finance Agent",
  marketing: "Brand guidelines, past campaigns — used by the Marketing & Website agents",
  operations: "Supplier lists, SOPs, menus — used by the Operations Agent",
  legal: "Leases, contracts — reference only",
  other: "Anything else",
};

const ACCEPTED = ".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.png,.jpg,.jpeg";
const MAX_SIZE = 20 * 1024 * 1024;

function KnowledgePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDocuments);
  const ingestFn = useServerFn(ingestDocument);
  const deleteFn = useServerFn(deleteDocument);
  const reprocessFn = useServerFn(reprocessDocument);

  const [category, setCategory] = useState<Category>("other");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const docs = useQuery({
    queryKey: ["knowledge-docs"],
    queryFn: () => listFn(),
    refetchInterval: (q) => {
      const d = q.state.data ?? [];
      return d.some((x: any) => x.status === "processing") ? 2500 : false;
    },
  });

  const upload = useMutation({
    mutationFn: async ({ file, cat }: { file: File; cat: Category }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not signed in");
      if (file.size > MAX_SIZE) throw new Error("File too large (max 20MB)");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${userId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("business-documents")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      await ingestFn({
        data: {
          storagePath,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          category: cat,
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge-docs"] }),
  });

  const del = useMutation({
    mutationFn: (documentId: string) => deleteFn({ data: { documentId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge-docs"] }),
  });

  const reprocess = useMutation({
    mutationFn: (documentId: string) => reprocessFn({ data: { documentId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge-docs"] }),
  });

  const filtered = useMemo(() => {
    const all = docs.data ?? [];
    return all.filter((d: any) => {
      if (filter !== "all" && d.category !== filter) return false;
      if (search && !d.file_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [docs.data, filter, search]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) upload.mutate({ file: f, cat: category });
  };

  return (
    <div className="space-y-8">
      {drawerId && <DocumentDrawer id={drawerId} onClose={() => setDrawerId(null)} />}

      <div className="animate-rise-in">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// KNOWLEDGE BASE</div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">
          Knowledge Base
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Upload your business documents so your AI team can reference them when building your plan,
          budget, and content.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={[
          "glass-panel p-8 border-2 border-dashed transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-slate-300/60",
        ].join(" ")}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold">Drag files here or browse</h3>
          <p className="mt-1 text-sm text-slate-600">PDF, DOCX, XLSX, CSV, TXT, PNG, JPG · up to 20MB per file</p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md cursor-pointer hover:opacity-90">
              <Upload className="h-4 w-4" />
              Browse files
              <input
                type="file"
                multiple
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Category:</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="rounded-xl border border-input bg-white/60 px-3 py-2 text-sm"
                title={CATEGORY_HELP[category]}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          {upload.isError && (
            <div className="mt-4 text-sm text-red-600">{(upload.error as Error).message}</div>
          )}
          {upload.isPending && (
            <div className="mt-4 text-sm text-primary">Uploading…</div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="glass-pill flex items-center gap-2 px-4 py-2 flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents"
            className="bg-transparent flex-1 outline-none text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c as any)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                filter === c ? "bg-primary text-primary-foreground" : "bg-white/60 border border-slate-200/60 text-slate-600 hover:bg-white/90",
              ].join(" ")}
            >
              {c === "all" ? "All" : CATEGORY_LABELS[c as Category]}
            </button>
          ))}
        </div>
      </div>

      {docs.isLoading ? (
        <div className="glass-panel p-10 text-center text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <FileText className="h-10 w-10 mx-auto text-slate-300" />
          <div className="mt-3 font-display text-lg font-semibold">No documents yet</div>
          <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
            Upload your first file so your AI team can get to know your business.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d: any) => (
            <DocRow
              key={d.id}
              doc={d}
              onOpen={() => setDrawerId(d.id)}
              onDelete={() => { if (confirm(`Delete "${d.file_name}"?`)) del.mutate(d.id); }}
              onReprocess={() => reprocess.mutate(d.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocRow({ doc, onOpen, onDelete, onReprocess }: {
  doc: any; onOpen: () => void; onDelete: () => void; onReprocess: () => void;
}) {
  return (
    <div className="glass p-4 flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
        <FileText className="h-5 w-5" />
      </div>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="font-medium truncate">{doc.file_name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5">{doc.category}</span>
          <span>{formatSize(doc.file_size)}</span>
          <span>·</span>
          <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
        </div>
      </button>
      <StatusPill status={doc.status} error={doc.status_error} />
      <div className="flex items-center gap-1">
        {doc.status === "failed" && (
          <button onClick={onReprocess} className="rounded-xl p-2 text-slate-500 hover:bg-white/70" title="Retry">
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        <button onClick={onDelete} className="rounded-xl p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status, error }: { status: string; error?: string | null }) {
  const map: Record<string, string> = {
    processing: "bg-amber-100 text-amber-700",
    indexed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
  };
  const label = status === "indexed" ? "Indexed" : status === "processing" ? "Processing…" : "Failed";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
        {label}
      </span>
      {status === "failed" && error && (
        <span className="text-[10px] text-red-500 max-w-[180px] truncate" title={error}>{error}</span>
      )}
    </div>
  );
}

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const getFn = useServerFn(getDocument);
  const q = useQuery({
    queryKey: ["knowledge-doc", id],
    queryFn: () => getFn({ data: { documentId: id } }),
  });

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const doc = q.data?.document;
  const isImage = doc?.file_type?.startsWith("image/");
  const isPdf = doc?.file_type === "application/pdf";

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="glass-modal my-4 mr-4 w-full max-w-2xl p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">// Document</div>
            <h2 className="mt-1 font-display text-xl font-bold truncate">{doc?.file_name ?? "Loading…"}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/70"><X className="h-4 w-4" /></button>
        </div>

        {q.isLoading && <div className="mt-8 text-sm text-muted-foreground">Loading…</div>}

        {doc && (
          <>
            {q.data?.signedUrl && (
              <div className="mt-5">
                {isImage && (
                  <img src={q.data.signedUrl} alt={doc.file_name} className="rounded-2xl border border-slate-200/60 max-h-96 w-auto mx-auto" />
                )}
                {isPdf && (
                  <iframe src={q.data.signedUrl} title={doc.file_name} className="w-full h-96 rounded-2xl border border-slate-200/60" />
                )}
                {!isImage && !isPdf && (
                  <a href={q.data.signedUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Download original</a>
                )}
              </div>
            )}

            {doc.extracted_text && (
              <div className="mt-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">// Extracted text (preview)</div>
                <pre className="whitespace-pre-wrap text-xs bg-white/60 border border-slate-200/60 rounded-2xl p-4 max-h-72 overflow-y-auto font-mono text-slate-700">
                  {doc.extracted_text.slice(0, 4000)}
                  {doc.extracted_text.length > 4000 && "\n\n…"}
                </pre>
              </div>
            )}

            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">// Used in</div>
              {(q.data?.sources ?? []).length === 0 ? (
                <div className="text-sm text-slate-500">Not referenced by any deliverable yet.</div>
              ) : (
                <ul className="space-y-1.5">
                  {(q.data?.sources ?? []).map((s: any) => (
                    <li key={s.agent_task_id} className="flex items-center gap-2 text-sm">
                      <Paperclip className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">{s.agent_tasks?.agent_id}</span>
                      <span className="text-slate-500">— {s.agent_tasks?.deliverable_title ?? "Deliverable"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
