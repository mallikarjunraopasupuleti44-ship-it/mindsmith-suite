import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ShieldCheck, Database, Briefcase, Zap, CheckCircle2, AlertCircle,
  Rocket, Settings, FileText, Megaphone, TrendingUp, Search, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AgentCard } from "@/components/AgentCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ReviewModal } from "@/components/ReviewModal";
import { MissionBriefing } from "@/components/MissionBriefing";
import { AtomLogo } from "@/components/AtomLogo";
import { AGENTS } from "@/lib/agents";
import type { AgentId } from "@/lib/agent-schemas";
import { getLatestProject, getProject, startMission, runAgent } from "@/lib/agents.functions";
import { useMutation } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

const AGENT_IDS = ["planner", "marketing", "finance", "operations", "website"] as const;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

function DashboardHome() {
  const qc = useQueryClient();
  const latestFn = useServerFn(getLatestProject);
  const projectFn = useServerFn(getProject);

  const latest = useQuery({ queryKey: ["latest-project"], queryFn: () => latestFn() });
  const projectId = latest.data?.id ?? null;

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectFn({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 3000;
      const working = d.tasks.some((t: any) => t.status === "working");
      return working ? 3000 : false;
    },
  });

  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`project-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_tasks", filter: `project_id=eq.${projectId}` }, () => {
        qc.invalidateQueries({ queryKey: ["project", projectId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_events", filter: `project_id=eq.${projectId}` }, () => {
        qc.invalidateQueries({ queryKey: ["project", projectId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, qc]);

  const hasMission = !!projectId && !!project.data;
  const tasks = project.data?.tasks ?? [];
  const isWorking = hasMission && tasks.some((t: any) => t.status === "working");
  const hasPending = hasMission && tasks.some((t: any) => t.status !== "approved");

  return isWorking ? (
    <MissionControl projectId={projectId!} />
  ) : (
    <IdleDashboard
      resumeMission={hasPending ? (project.data?.project?.mission ?? null) : null}
      onResume={hasPending && projectId ? () => {
        const el = document.getElementById("resume-mission-anchor");
        void el;
      } : undefined}
    />
  );
}

// ==================== IDLE ====================

function IdleDashboard({
  resumeMission,
}: {
  resumeMission?: string | null;
  onResume?: () => void;
}) {
  const navigate = useNavigate();
  const [deploying, setDeploying] = useState(false);

  const { data: userAndProfile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return { user: null, profile: null };
      const { data: p } = await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
      return { user: data.user, profile: p };
    },
  });

  const { data: docCount } = useQuery({
    queryKey: ["docs-count"],
    queryFn: async () => {
      const { count } = await supabase.from("knowledge_documents").select("*", { count: "exact", head: true }).eq("status", "indexed");
      return count ?? 0;
    },
  });

  const { data: agentsActive } = useQuery({
    queryKey: ["agents-active"],
    queryFn: async () => {
      const { count } = await supabase.from("agent_tasks").select("*", { count: "exact", head: true }).eq("status", "working");
      return count ?? 0;
    },
    refetchInterval: 5000,
  });

  const username = userAndProfile?.profile?.username ?? "there";
  const profileComplete = !!userAndProfile?.profile?.username;

  const chips = [
    profileComplete
      ? { icon: CheckCircle2, label: "Complete Profile", tone: "ok" as const }
      : { icon: AlertCircle, label: "Missing Profile", tone: "warn" as const },
    { icon: Database, label: `${docCount ?? 0} Docs Loaded`, tone: "neutral" as const },
    { icon: Briefcase, label: `${agentsActive ?? 0} Agents Active`, tone: "neutral" as const },
    { icon: Zap, label: "0 Automations", tone: "neutral" as const },
    { icon: ShieldCheck, label: "Secure Workspace", tone: "ok" as const },
  ];

  const quickActions = [
    { icon: FileText, title: "Generate Business Plan", body: "Create a comprehensive strategy.", intent: "A business plan for" },
    { icon: Megaphone, title: "Marketing Strategy", body: "Plan campaigns and content.", intent: "A marketing strategy for" },
    { icon: TrendingUp, title: "Revenue Analysis", body: "Forecast and financial models.", intent: "Revenue analysis for" },
    { icon: Search, title: "Research Competitors", body: "Analyze market landscape.", intent: "Competitor research for" },
    { icon: Upload, title: "Upload Knowledge", body: "Add PDFs, links, or text.", to: "/dashboard/knowledge" },
  ];

  return (
    <div className="space-y-10">
      {resumeMission && (
        <div className="glass flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
          <div className="text-slate-600">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-primary">// Pending mission</span>
            <span className="ml-3 text-slate-800">"{resumeMission}" — deliverables awaiting review.</span>
          </div>
        </div>
      )}
      <section className="glass-panel p-10 md:p-14 text-center animate-rise-in">
        <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary/5 pulse-violet">
          <AtomLogo size={96} />
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
          {greeting()}, {username}
        </h1>
        <p className="mt-3 text-slate-500">
          Your AI Business Operating System is online. Agents are standing by.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {chips.map((c, i) => {
            const Icon = c.icon;
            const cls =
              c.tone === "ok" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
              : c.tone === "warn" ? "text-amber-600 bg-amber-50 border-amber-200"
              : "text-slate-600 bg-white/70 border-slate-200";
            return (
              <div key={i} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${cls}`}>
                <Icon className="h-3.5 w-3.5" /> {c.label}
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setDeploying(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-primary/40 transition-all"
          >
            <Rocket className="h-4 w-4" /> Deploy AI Workforce
          </button>
          <Link
            to="/dashboard/knowledge"
            className="inline-flex items-center gap-2 rounded-2xl border border-input bg-white/60 px-6 py-3 text-sm font-semibold hover:bg-white/90"
          >
            <Settings className="h-4 w-4" /> System Settings
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Quick Actions</div>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Quick Actions</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {quickActions.map((qa) => {
            const Icon = qa.icon;
            const handle = () => {
              if (qa.to) navigate({ to: qa.to as any });
              else navigate({ to: "/dashboard/start", search: { seed: qa.intent } as any });
            };
            return (
              <button
                key={qa.title}
                onClick={handle}
                className="glass p-5 text-left hover:-translate-y-0.5 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 font-display font-semibold text-sm">{qa.title}</div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{qa.body}</p>
              </button>
            );
          })}
        </div>
      </section>

      {deploying && <DeployInlineModal onClose={() => setDeploying(false)} />}
    </div>
  );
}

function DeployInlineModal({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [briefingFor, setBriefingFor] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const start = useServerFn(startMission);
  const run = useServerFn(runAgent);

  const mutation = useMutation({
    mutationFn: async (mission: string) => {
      const { projectId } = await start({ data: { mission } });
      void (async () => {
        try {
          await run({ data: { projectId, agentId: "planner" } });
          await Promise.all(
            AGENT_IDS.filter((a) => a !== "planner").map((agentId) =>
              run({ data: { projectId, agentId } }).catch((e) => console.error(agentId, e)),
            ),
          );
        } finally {
          qc.invalidateQueries({ queryKey: ["project", projectId] });
        }
      })();
      return projectId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["latest-project"] });
      onClose();
    },
  });

  return (
    <>
      {briefingFor && <MissionBriefing mission={briefingFor} onDone={() => mutation.mutate(briefingFor)} />}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="glass-modal w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Deploy AI Workforce</div>
          <h2 className="mt-1 font-display text-2xl font-bold">What business do you want to build?</h2>
          <div className="mt-5 flex gap-2">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input.trim() && setBriefingFor(input.trim())}
              placeholder="I want to start a bakery"
              className="flex-1 rounded-xl border border-input bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => input.trim() && setBriefingFor(input.trim())}
              disabled={!input.trim() || mutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Rocket className="h-4 w-4" />
              Deploy
            </button>
          </div>
          <div className="mt-4 text-right">
            <button onClick={() => navigate({ to: "/dashboard/start" })} className="text-xs text-slate-500 hover:text-primary">
              Open Start Business →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== ACTIVE ====================

function MissionControl({ projectId }: { projectId: string }) {
  const projectFn = useServerFn(getProject);
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectFn({ data: { projectId } }),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 3000;
      return d.tasks.some((t: any) => t.status === "working") ? 3000 : false;
    },
  });
  const [reviewing, setReviewing] = useState<AgentId | null>(null);

  const p = project.data;
  const mission = p?.project?.mission ?? "Loading…";
  const tasks = p?.tasks ?? [];
  const activity = p?.activity ?? [];
  const sources = p?.sources ?? [];
  const activeCount = tasks.filter((t: any) => t.status === "working").length;

  const taskByAgent = new Map<string, any>();
  for (const t of tasks) taskByAgent.set(t.agent_id, t);

  const sourcesByTask = new Map<string, { file_name: string; document_id: string }[]>();
  for (const s of sources as any[]) {
    const list = sourcesByTask.get(s.agent_task_id) ?? [];
    list.push({ file_name: s.knowledge_documents?.file_name ?? "Document", document_id: s.document_id });
    sourcesByTask.set(s.agent_task_id, list);
  }

  const reviewingTask = reviewing ? taskByAgent.get(reviewing) : null;

  return (
    <div className="space-y-8">
      {reviewingTask && (
        <ReviewModal
          agentId={reviewing!}
          task={reviewingTask}
          sources={sourcesByTask.get(reviewingTask.id) ?? []}
          onClose={() => setReviewing(null)}
        />
      )}

      <div className="glass-panel p-8 animate-rise-in">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Mission Control</div>
        <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold tracking-tight">
          Current mission: <span className="text-primary">"{mission}"</span>
        </h1>
        <div className="mt-6 flex flex-col md:flex-row items-stretch gap-2 rounded-2xl bg-white/40 border border-slate-200/60 p-2">
          <div className="flex-1 px-4 py-3 text-sm text-slate-700">{mission}</div>
          <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary/15 px-6 py-3 text-sm font-semibold text-primary pulse-violet">
            <span className="h-2 w-2 rounded-full bg-primary pulse-dot" />
            {activeCount > 0 ? `Team working (${activeCount})` : "All deliverables ready"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          {AGENTS.map((a, i) => {
            const t = taskByAgent.get(a.id);
            return (
              <AgentCard
                key={a.id}
                agentId={a.id}
                task={t}
                referencedDocs={t ? sourcesByTask.get(t.id) ?? [] : []}
                onReview={setReviewing}
                delay={i * 60}
              />
            );
          })}
        </div>
        <div className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]">
          <ActivityFeed events={activity} />
        </div>
      </div>
    </div>
  );
}
