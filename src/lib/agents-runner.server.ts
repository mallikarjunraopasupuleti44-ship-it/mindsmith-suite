// Server-only: agent execution logic. Imported lazily from *.functions.ts handlers.
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { createGateway, CHAT_MODEL, embedText } from "./ai-gateway.server";
import { AGENT_SCHEMAS, AGENT_CATEGORY, type AgentId } from "./agent-schemas";
import { systemPrompt, userPrompt } from "./agent-prompts.server";
import { agentDefaults, mergeDefaults } from "./agent-defaults";

function languageLabel(code: string): string {
  const map: Record<string, string> = { telugu: "Telugu (తెలుగు)", hindi: "Hindi (हिन्दी)", english: "English" };
  return map[code] ?? code;
}

export async function runAgentImpl(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  agentId: AgentId,
  language?: string | null,
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
  const langInstruction = language && language !== "english"
    ? `\n\nIMPORTANT LANGUAGE REQUIREMENT: Write ALL string values in the JSON response in ${languageLabel(language)} using its native script. Keep JSON keys, hex colors, numbers, dates, and week labels (e.g. "Weeks 1-4", "M1") in English. Brand names may stay in English if that's the natural form.`
    : "";
  const usr = userPrompt(agentId, project.mission, brand, docContext, profile ?? null) + langInstruction;

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

// Coerce common LLM-shape variants back into the schema before merging defaults.
function normalizeDeliverable(agentId: AgentId, v: any): any {
  if (!v || typeof v !== "object") return v;
  if (agentId === "planner") return normalizePlanner(v);
  return v;
}

function toStringItem(x: any): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  // Common LLM object shapes → collapse to "Label — detail"
  const label = x.name ?? x.title ?? x.stream ?? x.kpi ?? x.KPI ?? x.metric ?? x.phase ?? x.item ?? x.headline;
  const detail = x.detail ?? x.details ?? x.description ?? x.target ?? x.value ?? x.body ?? x.actions ?? x.focus;
  if (label && detail) return `${label} — ${detail}`;
  if (label) return String(label);
  if (detail) return String(detail);
  try { return JSON.stringify(x); } catch { return ""; }
}

function normalizePlanner(v: any): any {
  const out: any = { ...v };

  // brand.voice sometimes comes as tagline / description
  if (out.brand && typeof out.brand === "object") {
    if (!out.brand.voice) {
      out.brand.voice = out.brand.tagline ?? out.brand.description ?? out.brand.tone ?? "";
    }
  }

  // market may be an object ({segments:[...], description}) or nested
  if (out.market && typeof out.market === "object") {
    const m = out.market;
    if (Array.isArray(m.segments)) {
      const segs = m.segments.map(toStringItem).filter(Boolean).join(" ");
      out.market = [m.description, m.summary, segs].filter(Boolean).join(" ").trim();
    } else if (Array.isArray(m)) {
      out.market = m.map(toStringItem).filter(Boolean).join(" ");
    } else {
      out.market = m.description ?? m.summary ?? m.text ?? "";
    }
  }
  if (!out.market && Array.isArray(out.segments)) {
    out.market = out.segments.map(toStringItem).filter(Boolean).join(" ");
  }

  // edge sometimes nested under market
  if (!Array.isArray(out.edge) && v.market && Array.isArray(v.market.edge)) {
    out.edge = v.market.edge;
  }
  if (Array.isArray(out.edge)) out.edge = out.edge.map(toStringItem).filter(Boolean);

  // revenue: strings, not objects
  if (Array.isArray(out.revenue)) out.revenue = out.revenue.map(toStringItem).filter(Boolean);

  // metrics: strings, not objects
  if (Array.isArray(out.metrics)) out.metrics = out.metrics.map(toStringItem).filter(Boolean);

  // roadmap: coerce {focus} → {actions}
  if (Array.isArray(out.roadmap)) {
    out.roadmap = out.roadmap.map((r: any) => ({
      phase: String(r?.phase ?? ""),
      weeks: String(r?.weeks ?? r?.timeline ?? ""),
      actions: String(r?.actions ?? r?.focus ?? r?.description ?? r?.details ?? ""),
    }));
  }

  // concept fallback from brand.tagline / first market sentence
  if (!out.concept || typeof out.concept !== "string") {
    out.concept = out.brand?.tagline ?? (typeof out.market === "string" ? out.market : "") ?? "";
  }

  return out;
}
