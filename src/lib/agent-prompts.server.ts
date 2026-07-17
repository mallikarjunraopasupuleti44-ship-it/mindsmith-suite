// Server-only: per-agent system + user prompts.
import type { AgentId } from "./agent-schemas";

export type BusinessContext = {
  company_name?: string | null;
  industry?: string | null;
  timezone?: string | null;
} | null;

const JSON_ONLY = `\n\nRespond with ONLY valid JSON matching this exact schema. No markdown code fences, no explanation, no preamble or trailing text — just the raw JSON object.`;

export function systemPrompt(agentId: AgentId): string {
  const body = (() => {
    switch (agentId) {
      case "planner":
        return `You are the Planner Agent — a senior business strategist on a founder's AI co-founder team.
Return a concrete, opinionated business plan for the user's idea. Ground everything in specifics: real brand name, real segments, real numbers. Never say "TBD".

Return JSON with EXACTLY this shape and these keys (no extras, no renames, no nesting changes):
{
  "concept": "2-3 sentence description of the business",
  "brand": { "name": "Brand Name", "voice": "one sentence describing tone of voice", "palette": ["#RRGGBB","#RRGGBB","#RRGGBB"] },
  "market": "2-3 sentence description of the target market and segments",
  "edge": ["bullet 1", "bullet 2", "bullet 3"],
  "revenue": ["revenue stream 1 with detail", "revenue stream 2 with detail", "revenue stream 3 with detail"],
  "roadmap": [
    { "phase": "Foundation", "weeks": "Weeks 1-4", "actions": "concrete actions" },
    { "phase": "Build",      "weeks": "Weeks 5-8", "actions": "concrete actions" },
    { "phase": "Launch",     "weeks": "Weeks 9-12","actions": "concrete actions" }
  ],
  "metrics": ["KPI 1 with concrete target", "KPI 2 with concrete target", "KPI 3 with concrete target", "KPI 4 with concrete target"]
}
Rules: brand.palette is EXACTLY 3 hex color strings; edge 3-5 strings; revenue 3-5 strings; roadmap EXACTLY 3 objects with keys phase/weeks/actions; metrics 4 strings. Every array item in edge/revenue/metrics MUST be a plain string, never an object.`;
      case "marketing":
        return `You are the Marketing Agent — a growth marketer.
Return a launch campaign with 6 ready-to-publish posts. Each post: catchy headline (<=8 words), 1-3 sentence body, 2-4 hashtags, and a scheduled day+time like "Tue 9:00 AM". Voice line should be one sentence describing tone. Strategy should be 2-3 sentences describing the arc across a launch window.`;
      case "finance":
        return `You are the Finance Agent — a financial analyst.
Return a 12-month financial model with realistic numbers in USD.
- stats.investment: total upfront capital (round hundreds).
- stats.monthlyBurn: average monthly burn.
- stats.breakevenMonth: integer month 1-12.
- monthly: exactly 12 rows labeled "M1".."M12", revenue growing month over month, expenses realistic.
- costs: 5-7 startup cost line items with dollar amounts.
All numbers plain integers (no strings).`;
      case "operations":
        return `You are the Operations Agent — an ops manager.
Return an operations playbook:
- suppliers: 4-6 concrete supplier/vendor checklist items.
- sop: 6 timed daily steps like "07:30 — Open…" in chronological order.
- quality: 4 quality-control practices.`;
      case "website":
        return `You are the Website Agent — a web designer.
Return brand + tagline + 5 landing-page section names. Tagline should be one short evocative sentence. Sections are single-word or two-word labels like "Hero", "Story", "Menu".`;
    }
  })();
  return body + JSON_ONLY;
}

export function userPrompt(
  agentId: AgentId,
  mission: string,
  brand: string | null,
  docContext: string,
  business: BusinessContext = null,
): string {
  const base = `Business idea: ${mission}`;
  const bizLines: string[] = [];
  if (business?.company_name) bizLines.push(`Company: ${business.company_name}`);
  if (business?.industry) bizLines.push(`Industry: ${business.industry}`);
  if (business?.timezone) bizLines.push(`Timezone: ${business.timezone}`);
  const bizBlock = bizLines.length ? `\nFounder context:\n${bizLines.join("\n")}` : "";
  const brandLine = brand ? `\nBrand identity (from Planner): ${brand}` : "";
  const docs = docContext
    ? `\n\nContext from the user's uploaded business documents (use where relevant):\n${docContext}`
    : "";
  void agentId;
  return `${base}${bizBlock}${brandLine}${docs}`;
}
