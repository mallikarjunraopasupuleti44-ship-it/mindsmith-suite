import { Pencil, Info, PlayCircle } from "lucide-react";
import { AGENT_MAP } from "@/lib/agents";
import { useMissionStore, type AgentId } from "@/lib/mission-store";
import { StatusPill } from "./StatusPill";

export function AgentCard({
  agentId,
  onReview,
  delay = 0,
}: {
  agentId: AgentId;
  onReview: (id: AgentId) => void;
  delay?: number;
}) {
  const meta = AGENT_MAP[agentId];
  const state = useMissionStore((s) => s.agents[agentId]);

  const primaryLabel =
    state.status === "idle"        ? "Assign task"
    : state.status === "working"     ? "Working…"
    : state.status === "needs_review" ? "Review work"
    : "View work";

  const primaryDisabled = state.status === "working";

  return (
    <div className="glass p-6 animate-rise-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold"
            style={{
              color: meta.accent,
              background: `${meta.accent}15`,
              boxShadow: `0 0 0 1px ${meta.accent}25, 0 4px 20px ${meta.accent}20`,
            }}
          >
            {meta.glyph}
          </div>
          <div>
            <div className="font-display text-base font-semibold leading-tight">{meta.name}</div>
            <div className="text-xs text-muted-foreground">{meta.role}</div>
          </div>
        </div>
        <StatusPill status={state.status} />
      </div>

      <p className="mt-4 text-sm text-slate-600 leading-relaxed">{meta.description}</p>

      <div className="mt-4 rounded-2xl bg-white/50 border border-slate-200/60 px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deliverable</div>
        <div className="mt-0.5 text-sm font-medium">
          {state.deliverableName ?? meta.deliverable}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          onClick={() => state.status !== "working" && onReview(agentId)}
          disabled={primaryDisabled}
          className={[
            "inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition-all",
            state.status === "needs_review" || state.status === "approved"
              ? "bg-primary text-primary-foreground hover:opacity-90 hover:-translate-y-0.5"
              : state.status === "working"
              ? "bg-primary/15 text-primary pulse-violet"
              : "border border-input bg-white/60 text-foreground hover:bg-white/80",
            primaryDisabled && "cursor-not-allowed",
          ].join(" ")}
        >
          {state.status === "idle" && <PlayCircle className="h-4 w-4" />}
          {primaryLabel}
        </button>
        <div className="flex items-center gap-1">
          <button className="rounded-xl p-2 text-slate-500 hover:bg-white/70" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button className="rounded-xl p-2 text-slate-500 hover:bg-white/70" aria-label="Info">
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
