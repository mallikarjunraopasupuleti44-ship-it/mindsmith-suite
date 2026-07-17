// Server-only: agent execution logic. Imported lazily from *.functions.ts handlers.
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { createGateway, CHAT_MODEL, embedText } from "./ai-gateway.server";
import { AGENT_SCHEMAS, AGENT_CATEGORY, type AgentId } from "./agent-schemas";
import { systemPrompt, userPrompt } from "./agent-prompts.server";

export async function runAgentImpl(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  agentId: AgentId,
) {
  // Fetch project + founder/business context + optional planner deliverable
  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("mission").eq("id", projectId).maybeSingle(),
    supabase.from("profiles").select("company_name, industry, timezone").eq("id", userId).maybeSingle(),
  ]);
  if (!project) throw new Error("Project not found");

  let brand: string | null = null;
  if (agentId !== "planner") {
    const { data: planner } = await supabase
      .from("agent_tasks")
      .select("deliverable, status")
      .eq("project_id", projectId)
      .eq("agent_id", "planner")
      .maybeSingle();
    const p = planner?.deliverable as any;
    if (p?.brand) brand = `${p.brand.name} — voice: ${p.brand.voice}; palette: ${(p.brand.palette ?? []).join(", ")}`;
  }

  // RAG: embed query, retrieve chunks
  const query = `${project.mission}${brand ? `\nBrand: ${brand}` : ""}`;
  let docContext = "";
  const usedDocIds = new Set<string>();
  try {
    const embedding = await embedText(query);
    const category = AGENT_CATEGORY[agentId];

    let chunks = await matchChunks(supabase, userId, embedding, category, 5);
    if ((!chunks || chunks.length === 0) && category) {
      chunks = await matchChunks(supabase, userId, embedding, null, 5);
    }
    if (chunks && chunks.length > 0) {
      docContext = chunks
        .map((c: any) => `[${c.file_name}]\n${c.chunk_text}`)
        .join("\n\n---\n\n");
      for (const c of chunks) usedDocIds.add(c.document_id);
    }
  } catch (err) {
    console.error("RAG lookup failed", err);
  }

  // Call the model
  const gateway = createGateway();
  const model = gateway(CHAT_MODEL);
  const schema = AGENT_SCHEMAS[agentId] as any;

  let deliverable: any = null;
  let errMsg: string | null = null;
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema }),
      system: systemPrompt(agentId),
      prompt: userPrompt(agentId, project.mission, brand, docContext, profile ?? null),
    });
    deliverable = output;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      try {
        deliverable = JSON.parse(err.text ?? "");
      } catch {
        errMsg = "The model returned malformed output. Try requesting a revision.";
      }
    } else {
      errMsg = (err as Error).message ?? "Agent failed";
    }
  }

  const title = titleFor(agentId, deliverable);
  const { data: task, error: updateErr } = await supabase
    .from("agent_tasks")
    .update({
      deliverable,
      deliverable_title: title,
      status: errMsg ? "working" : "needs_review",
      error: errMsg,
    })
    .eq("project_id", projectId)
    .eq("agent_id", agentId)
    .select()
    .single();
  if (updateErr) throw new Error(updateErr.message);

  if (errMsg) {
    await supabase.from("activity_events").insert({
      project_id: projectId,
      agent: agentId,
      message: `Error: ${errMsg}`,
    });
    // Flip to needs_review so the UI shows an error state
    await supabase.from("agent_tasks").update({ status: "needs_review" }).eq("id", task.id);
    return { ok: false, error: errMsg };
  }

  // Record sources
  if (usedDocIds.size > 0) {
    await supabase.from("deliverable_sources").insert(
      [...usedDocIds].map((document_id) => ({ agent_task_id: task.id, document_id })),
    );
  }

  await supabase.from("activity_events").insert({
    project_id: projectId,
    agent: agentId,
    message: `Deliverable ready for review — ${title}${usedDocIds.size ? ` (referenced ${usedDocIds.size} doc${usedDocIds.size === 1 ? "" : "s"})` : ""}`,
  });

  return { ok: true, taskId: task.id };
}

async function matchChunks(
  supabase: SupabaseClient,
  userId: string,
  embedding: number[],
  category: string | null,
  k: number,
) {
  const { data, error } = await supabase.rpc("match_document_chunks", {
    p_user_id: userId,
    query_embedding: embedding as any,
    p_category: category,
    match_count: k,
  });
  if (error) {
    console.error("match_document_chunks failed", error.message);
    return [];
  }
  return data as any[];
}

function titleFor(agentId: AgentId, d: any): string {
  const brand = d?.brand?.name ?? d?.brand ?? "Business";
  return {
    planner: `${brand} — Business Plan`,
    marketing: `${brand} — Launch Campaign`,
    finance: `${brand} — Financial Model`,
    operations: `${brand} — Operations Playbook`,
    website: `${brand} — Landing Page`,
  }[agentId];
}
