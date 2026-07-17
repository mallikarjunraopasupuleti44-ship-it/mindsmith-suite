import { Paperclip, PlayCircle } from "lucide-react";
import { AGENT_MAP } from "@/lib/agents";
import type { AgentId } from "@/lib/agent-schemas";
import { StatusPill } from "./StatusPill";

export interface AgentTask {
  id: string;
  status: string;
  deliverable_title: string | null;
  error: string | null;
}

export function AgentCard({
  agentId,
  task,
  referencedDocs,
  onReview,
  delay = 0,
}: {
  agentId: AgentId;
  task?: AgentTask;
  referencedDocs?: { file_name: string; document_id: string }[];
  onReview: (id: AgentId) => void;
  delay?: number;
}) {
  const meta = AGENT_MAP[agentId];
  const status = task?.status ?? "idle";

  const primaryLabel =
    status === "idle" ? "Waiting"
    : status === "working" ? "Working…"
    : status === "needs_review" ? "Review work"
    : "View work";

  const primaryDisabled = status === "working" || status === "idle";

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
        <StatusPill status={status} />
      </div>

      <p className="mt-4 text-sm text-slate-600 leading-relaxed">{meta.description}</p>

      <div className="mt-4 rounded-2xl bg-white/50 border border-slate-200/60 px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deliverable</div>
        <div className="mt-0.5 text-sm font-medium">
          {task?.deliverable_title ?? meta.deliverable}
        </div>
      </div>

      {referencedDocs && referencedDocs.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-primary">
          <Paperclip className="h-3.5 w-3.5" />
          Referenced {referencedDocs.length} document{referencedDocs.length === 1 ? "" : "s"}
        </div>
      )}

      {task?.error && (
        <div className="mt-3 text-xs text-red-600 truncate" title={task.error}>{task.error}</div>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          onClick={() => !primaryDisabled && onReview(agentId)}
          disabled={primaryDisabled}
          className={[
            "inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition-all",
            status === "needs_review" || status === "approved"
              ? "bg-primary text-primary-foreground hover:opacity-90 hover:-translate-y-0.5"
              : status === "working"
              ? "bg-primary/15 text-primary pulse-violet"
              : "border border-input bg-white/60 text-foreground opacity-70",
            primaryDisabled && "cursor-not-allowed",
          ].join(" ")}
        >
          {status === "idle" && <PlayCircle className="h-4 w-4" />}
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
