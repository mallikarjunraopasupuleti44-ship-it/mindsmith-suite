import type { AgentId } from "./mission-store";

export interface AgentMeta {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  deliverable: string;
  accent: string; // hex
  glyph: string;  // emoji-ish glyph
}

export const AGENTS: AgentMeta[] = [
  {
    id: "planner",
    name: "Planner Agent",
    role: "Business Strategist",
    description: "Turns your idea into a complete business plan: concept, brand, market and roadmap.",
    deliverable: "Business Plan",
    accent: "#5B4FE9",
    glyph: "◆",
  },
  {
    id: "marketing",
    name: "Marketing Agent",
    role: "Growth Marketer",
    description: "Creates ready-to-publish social content with captions, hashtags and a posting schedule.",
    deliverable: "Launch Campaign",
    accent: "#EC4899",
    glyph: "✦",
  },
  {
    id: "finance",
    name: "Finance Agent",
    role: "Financial Analyst",
    description: "Builds startup cost analysis, break-even point and 12-month projections with charts.",
    deliverable: "Financial Model",
    accent: "#10B981",
    glyph: "▲",
  },
  {
    id: "operations",
    name: "Operations Agent",
    role: "Operations Manager",
    description: "Produces weekly schedules, supplier checklists and standard operating procedures.",
    deliverable: "Ops Playbook",
    accent: "#F59E0B",
    glyph: "●",
  },
  {
    id: "website",
    name: "Website Agent",
    role: "Web Developer",
    description: "Generates a live landing page for your business using the brand identity.",
    deliverable: "Landing Page",
    accent: "#0EA5E9",
    glyph: "❖",
  },
];

export const AGENT_MAP: Record<AgentId, AgentMeta> = AGENTS.reduce((acc, a) => {
  acc[a.id] = a;
  return acc;
}, {} as Record<AgentId, AgentMeta>);
