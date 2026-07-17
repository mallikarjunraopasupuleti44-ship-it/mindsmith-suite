import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AgentId = "planner" | "marketing" | "finance" | "operations" | "website";
export type AgentStatus = "idle" | "working" | "needs_review" | "approved";

export interface AgentState {
  id: AgentId;
  status: AgentStatus;
  deliverableName: string | null;
}

export interface ActivityEvent {
  id: string;
  ts: number;
  agent: AgentId | "system";
  message: string;
}

interface MissionState {
  mission: string | null;
  startedAt: number | null;
  agents: Record<AgentId, AgentState>;
  activity: ActivityEvent[];
  stats: {
    tasksCompleted: number;
    wordsProduced: number;
    hoursSaved: number;
    agentsActive: number;
  };
  startMission: (mission: string) => void;
  setAgentStatus: (id: AgentId, status: AgentStatus, deliverableName?: string) => void;
  pushActivity: (e: Omit<ActivityEvent, "id" | "ts">) => void;
  reset: () => void;
}

const initialAgents: Record<AgentId, AgentState> = {
  planner:    { id: "planner",    status: "idle", deliverableName: null },
  marketing:  { id: "marketing",  status: "idle", deliverableName: null },
  finance:    { id: "finance",    status: "idle", deliverableName: null },
  operations: { id: "operations", status: "idle", deliverableName: null },
  website:    { id: "website",    status: "idle", deliverableName: null },
};

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      mission: null,
      startedAt: null,
      agents: initialAgents,
      activity: [],
      stats: { tasksCompleted: 0, wordsProduced: 0, hoursSaved: 0, agentsActive: 0 },

      startMission: (mission) => {
        set({
          mission,
          startedAt: Date.now(),
          agents: {
            planner:    { id: "planner",    status: "working", deliverableName: null },
            marketing:  { id: "marketing",  status: "working", deliverableName: null },
            finance:    { id: "finance",    status: "working", deliverableName: null },
            operations: { id: "operations", status: "working", deliverableName: null },
            website:    { id: "website",    status: "working", deliverableName: null },
          },
          activity: [],
          stats: { tasksCompleted: 0, wordsProduced: 0, hoursSaved: 0, agentsActive: 5 },
        });
        const push = get().pushActivity;
        push({ agent: "system", message: `Mission received: "${mission}"` });
        push({ agent: "system", message: "Assembling AI workforce..." });
        push({ agent: "planner", message: "Analyzing business concept and brand direction" });
        push({ agent: "marketing", message: "Drafting campaign strategy and voice" });
        push({ agent: "finance", message: "Modeling startup costs and 12-month projections" });
        push({ agent: "operations", message: "Compiling supplier checklist and SOPs" });
        push({ agent: "website", message: "Generating landing page from brand identity" });
      },

      setAgentStatus: (id, status, deliverableName) =>
        set((s) => {
          const agents = { ...s.agents, [id]: { ...s.agents[id], status, deliverableName: deliverableName ?? s.agents[id].deliverableName } };
          const active = Object.values(agents).filter((a) => a.status === "working").length;
          const completed = Object.values(agents).filter((a) => a.status === "approved").length;
          return {
            agents,
            stats: {
              ...s.stats,
              agentsActive: active,
              tasksCompleted: completed,
              wordsProduced: completed * 1240 + Object.values(agents).filter(a => a.status === "needs_review").length * 900,
              hoursSaved: Math.round(completed * 6.5 + Object.values(agents).filter(a => a.status === "needs_review").length * 4),
            },
          };
        }),

      pushActivity: (e) =>
        set((s) => ({
          activity: [
            { ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now() },
            ...s.activity,
          ].slice(0, 80),
        })),

      reset: () =>
        set({
          mission: null,
          startedAt: null,
          agents: initialAgents,
          activity: [],
          stats: { tasksCompleted: 0, wordsProduced: 0, hoursSaved: 0, agentsActive: 0 },
        }),
    }),
    { name: "aura-mission" },
  ),
);
