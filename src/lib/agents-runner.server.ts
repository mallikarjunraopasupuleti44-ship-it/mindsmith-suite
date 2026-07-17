// Server-only: agent execution logic. Imported lazily from *.functions.ts handlers.
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { createGateway, CHAT_MODEL, embedText } from "./ai-gateway.server";
import { AGENT_SCHEMAS, AGENT_CATEGORY, type AgentId } from "./agent-schemas";
import { systemPrompt, userPrompt } from "./agent-prompts.server";
import { agentDefaults, mergeDefaults } from "./agent-defaults";

export async function runAgentImpl(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  agentId: AgentId,
) {
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

  // RAG
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
      docContext = chunks.map((c: any) => `[${c.file_name}]\n${c.chunk_text}`).join("\n\n---\n\n");
      for (const c of chunks) usedDocIds.add(c.document_id);
    }
  } catch (err) {
    console.error(`[agent:${agentId}] RAG lookup failed`, err);
  }

  const schema = AGENT_SCHEMAS[agentId] as any;
  const sys = systemPrompt(agentId);
  const usr = userPrompt(agentId, project.mission, brand, docContext, profile ?? null);

  // Attempt with retry
  const attempt = await generateWithRetry(agentId, sys, usr, schema);

  let deliverable: any = null;
  let errMsg: string | null = null;

  if (attempt.ok) {
    const normalized = normalizeDeliverable(agentId, attempt.value);
    deliverable = mergeDefaults(agentId, normalized);
  } else {
    console.error(`[agent:${agentId}] final failure`, {
      error: attempt.error,
      rawSample: attempt.raw?.slice(0, 2000),
    });
    // Save safe defaults so UI doesn't crash, and surface reason.
    deliverable = agentDefaults(agentId);
    errMsg = attempt.error;
  }

  const title = titleFor(agentId, deliverable);
  const { data: task, error: updateErr } = await supabase
    .from("agent_tasks")
    .update({
      deliverable,
      deliverable_title: title,
      status: "needs_review",
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
      message: `Needs review — ${errMsg}`,
    });
    return { ok: false, taskId: task.id, error: errMsg };
  }

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

type AttemptResult =
  | { ok: true; value: any }
  | { ok: false; error: string; raw?: string };

async function generateWithRetry(
  agentId: AgentId,
  system: string,
  prompt: string,
  schema: any,
): Promise<AttemptResult> {
  const first = await runOnce(agentId, system, prompt, schema, false);
  if (first.ok) return first;
  console.warn(`[agent:${agentId}] first attempt failed: ${first.error}. Retrying with stricter reminder.`);
  const stricter = `${prompt}\n\nSTRICT REMINDER: Your previous response was not valid JSON matching the schema. Return ONLY the raw JSON object — no code fences, no commentary, no trailing text. Ensure every required field is present and the JSON is complete and parseable.`;
  const second = await runOnce(agentId, system, stricter, schema, true);
  return second;
}

async function runOnce(
  agentId: AgentId,
  system: string,
  prompt: string,
  schema: any,
  isRetry: boolean,
): Promise<AttemptResult> {
  const gateway = createGateway();
  const model = gateway(CHAT_MODEL);
  let raw: string | undefined;
  try {
    const { output, text } = await generateText({
      model,
      output: Output.object({ schema }),
      system,
      prompt,
      // Give complex JSON room to complete.
      maxOutputTokens: 8192,
    });
    raw = text;
    const validated = schema.safeParse(output);
    if (validated.success) return { ok: true, value: validated.data };
    console.warn(`[agent:${agentId}] schema mismatch (${isRetry ? "retry" : "first"})`, validated.error.issues.slice(0, 5));
    // Try merging defaults anyway
    return { ok: true, value: output };
  } catch (err) {
    // Try defensive parse from raw text
    if (NoObjectGeneratedError.isInstance(err)) {
      raw = err.text ?? raw;
      const salvaged = defensiveParse(raw ?? "");
      if (salvaged) {
        const validated = schema.safeParse(salvaged);
        if (validated.success) return { ok: true, value: validated.data };
        return { ok: true, value: salvaged };
      }
      console.error(`[agent:${agentId}] NoObjectGeneratedError`, {
        message: (err as Error).message,
        rawSample: raw?.slice(0, 2000),
      });
      return { ok: false, error: "The model returned malformed JSON.", raw };
    }
    console.error(`[agent:${agentId}] generate error`, err);
    return { ok: false, error: (err as Error).message ?? "Agent call failed", raw };
  }
}

function defensiveParse(response: string): unknown | null {
  if (!response) return null;
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const startIdx = cleaned.search(/[\{\[]/);
  if (startIdx === -1) return null;
  const opener = cleaned[startIdx];
  const closer = opener === "[" ? "]" : "}";
  const endIdx = cleaned.lastIndexOf(closer);
  if (endIdx === -1 || endIdx < startIdx) return null;
  cleaned = cleaned.substring(startIdx, endIdx + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      const fixed = cleaned
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, "");
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
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
