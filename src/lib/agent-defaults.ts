// Safe fallback shapes per agent so the UI never crashes on missing fields.
import type { AgentId } from "./agent-schemas";

export function agentDefaults(agentId: AgentId): any {
  switch (agentId) {
    case "planner":
      return {
        concept: "",
        brand: { name: "Business", voice: "", palette: ["#111827", "#6366F1", "#F59E0B"] },
        market: "",
        edge: [],
        revenue: [],
        roadmap: [
          { phase: "Foundation", weeks: "Weeks 1-4", actions: "" },
          { phase: "Build", weeks: "Weeks 5-8", actions: "" },
          { phase: "Launch", weeks: "Weeks 9-12", actions: "" },
        ],
        metrics: [],
      };
    case "marketing":
      return { voice: "", strategy: "", posts: [] };
    case "finance":
      return {
        stats: { investment: 0, monthlyBurn: 0, breakevenMonth: 0 },
        monthly: [],
        costs: [],
      };
    case "operations":
      return { suppliers: [], sop: [], quality: [] };
    case "website":
      return { brand: "Business", tagline: "", sections: [] };
  }
}

export function mergeDefaults(agentId: AgentId, value: any): any {
  const def = agentDefaults(agentId);
  return deepMerge(def, value ?? {});
}

function deepMerge(base: any, over: any): any {
  if (Array.isArray(base)) return Array.isArray(over) && over.length > 0 ? over : base;
  if (base && typeof base === "object") {
    if (!over || typeof over !== "object") return base;
    const out: any = { ...base };
    for (const k of Object.keys(base)) {
      out[k] = k in over ? deepMerge(base[k], over[k]) : base[k];
    }
    for (const k of Object.keys(over)) {
      if (!(k in out)) out[k] = over[k];
    }
    return out;
  }
  return over ?? base;
}
