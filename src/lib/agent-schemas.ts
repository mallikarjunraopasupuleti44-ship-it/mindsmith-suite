import { z } from "zod";

// Kept flat and constraint-free — enforce lengths/counts in the prompt.
export const plannerSchema = z.object({
  concept: z.string(),
  brand: z.object({
    name: z.string(),
    voice: z.string(),
    palette: z.array(z.string()),
  }),
  market: z.string(),
  edge: z.array(z.string()),
  revenue: z.array(z.string()),
  roadmap: z.array(z.object({
    phase: z.string(),
    weeks: z.string(),
    actions: z.string(),
  })),
  metrics: z.array(z.string()),
});

export const marketingSchema = z.object({
  voice: z.string(),
  strategy: z.string(),
  posts: z.array(z.object({
    time: z.string(),
    headline: z.string(),
    body: z.string(),
    tags: z.array(z.string()),
  })),
});

export const financeSchema = z.object({
  stats: z.object({
    investment: z.number(),
    monthlyBurn: z.number(),
    breakevenMonth: z.number(),
  }),
  monthly: z.array(z.object({
    month: z.string(),
    revenue: z.number(),
    expenses: z.number(),
  })),
  costs: z.array(z.object({
    name: z.string(),
    value: z.number(),
  })),
});

export const operationsSchema = z.object({
  suppliers: z.array(z.string()),
  sop: z.array(z.string()),
  quality: z.array(z.string()),
});

export const websiteSchema = z.object({
  brand: z.string(),
  tagline: z.string(),
  sections: z.array(z.string()),
});

export const AGENT_SCHEMAS = {
  planner: plannerSchema,
  marketing: marketingSchema,
  finance: financeSchema,
  operations: operationsSchema,
  website: websiteSchema,
} as const;

export type AgentId = keyof typeof AGENT_SCHEMAS;

export const AGENT_CATEGORY: Record<AgentId, string | null> = {
  planner: null,
  marketing: "marketing",
  finance: "financial",
  operations: "operations",
  website: "marketing",
};
