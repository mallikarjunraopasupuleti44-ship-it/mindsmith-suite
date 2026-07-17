import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Rocket, CheckCircle2, XCircle, Clock, PlayCircle } from "lucide-react";
import { listMissionHistory, abandonMission, completeMission } from "@/lib/history.functions";
import { getProject } from "@/lib/agents.functions";
import { AGENTS } from "@/lib/agents";
import { ReviewModal } from "@/components/ReviewModal";
import type { AgentId } from "@/lib/agent-schemas";

export const Route = createFileRoute("/_authenticated/dashboard/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const listFn = useServerFn(listMissionHistory);
  const { data, isLoading } = useQuery({ queryKey: ["mission-history"], queryFn: () => listFn() });
  const [viewing, setViewing] = useState<string | null>(null);

  if (viewing) return <MissionDetail projectId={viewing} onBack={() => setViewing(null)} />;

  if (isLoading) return <div className="glass p-6 text-sm text-slate-500">Loading…</div>;

  const missions = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// History</div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Past missions</h1>
      </div>

      {missions.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <Rocket className="mx-auto h-10 w-10 text-primary/40" />
          <p className="mt-4 text-slate-600">No missions yet — start your first one.</p>
          <Link to="/dashboard/start" className="mt-4 inline-flex btn-primary">Start a business</Link>
        </div>
      ) : (
        <div className="glass-panel divide-y divide-slate-200/60">
          {missions.map((m: any) => (
            <button
              key={m.id}
              onClick={() => setViewing(m.id)}
              className="w-full flex flex-col md:flex-row md:items-center gap-3 p-5 text-left hover:bg-white/40 transition"
            >
              <div className="flex-1">
                <div className="font-display font-semibold text-slate-900 line-clamp-1">{m.title ?? m.mission}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Started {new Date(m.created_at).toLocaleDateString()}
                  {m.completed_at && ` · Ended ${new Date(m.completed_at).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{m.approvedCount}/5 approved</span>
                <StatusBadge status={m.status} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: any; cls: string; label: string }> = {
    draft:      { icon: Clock,      cls: "text-slate-500 bg-slate-100 border-slate-200",   label: "Draft" },
    running:    { icon: PlayCircle, cls: "text-primary bg-primary/10 border-primary/20",   label: "In Progress" },
    completed:  { icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 border-emerald-200", label: "Completed" },
    abandoned:  { icon: XCircle,    cls: "text-rose-500 bg-rose-50 border-rose-200",       label: "Abandoned" },
  };
  const s = map[status] ?? map.draft;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
      <Icon className="h-3.5 w-3.5" /> {s.label}
    </span>
  );
}

function MissionDetail({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const projectFn = useServerFn(getProject);
  const abandonFn = useServerFn(abandonMission);
  const completeFn = useServerFn(completeMission);

  const { data, isLoading } = useQuery({
    queryKey: ["mission-detail", projectId],
    queryFn: () => projectFn({ data: { projectId } }),
  });
  const [reviewing, setReviewing] = useState<AgentId | null>(null);

  const abandon = useMutation({
    mutationFn: async () => abandonFn({ data: { projectId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mission-history"] });
      qc.invalidateQueries({ queryKey: ["latest-project"] });
      onBack();
    },
  });
  const complete = useMutation({
    mutationFn: async () => completeFn({ data: { projectId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mission-history"] });
      qc.invalidateQueries({ queryKey: ["latest-project"] });
    },
  });

  if (isLoading || !data) return <div className="glass p-6 text-sm text-slate-500">Loading…</div>;

  const tasks = data.tasks ?? [];
  const taskByAgent = new Map<string, any>();
  for (const t of tasks) taskByAgent.set(t.agent_id, t);
  const status = data.project?.status ?? "running";
  const approved = tasks.filter((t: any) => t.status === "approved").length;
  const reviewingTask = reviewing ? taskByAgent.get(reviewing) : null;

  return (
    <div className="space-y-6">
      {reviewingTask && (
        <ReviewModal agentId={reviewing!} task={reviewingTask} sources={[]} onClose={() => setReviewing(null)} />
      )}
      <button onClick={onBack} className="text-xs font-mono uppercase tracking-[0.18em] text-slate-500 hover:text-primary">
        ← Back to history
      </button>

      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Mission</div>
            <h1 className="mt-1 font-display text-2xl font-bold">{data.project?.title ?? data.project?.mission}</h1>
            <p className="mt-1 text-sm text-slate-500">{data.project?.mission}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="mt-4 text-xs text-slate-500">{approved}/5 deliverables approved</div>
        {(status === "running" || status === "draft") && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => navigate({ to: "/dashboard" })} className="btn-secondary">Open in Mission Control</button>
            <button onClick={() => complete.mutate()} className="btn-primary" disabled={complete.isPending}>
              Mark as completed
            </button>
            <button onClick={() => abandon.mutate()} disabled={abandon.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100">
              Abandon mission
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {AGENTS.map((a) => {
          const t = taskByAgent.get(a.id);
          return (
            <div key={a.id} className="glass p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-display text-lg" style={{ color: a.accent }}>
                  {a.glyph}
                </div>
                <div>
                  <div className="font-display font-semibold text-sm">{a.name}</div>
                  <div className="text-xs text-slate-500">{t?.deliverable_title ?? a.deliverable}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-500 capitalize">{t?.status ?? "idle"}</span>
                {t?.deliverable ? (
                  <button onClick={() => setReviewing(a.id as AgentId)} className="text-xs font-semibold text-primary hover:underline">
                    View work →
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">No output</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
