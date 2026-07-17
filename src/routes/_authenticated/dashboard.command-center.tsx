import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AgentCard } from "@/components/AgentCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ReviewModal } from "@/components/ReviewModal";
import { AGENTS } from "@/lib/agents";
import type { AgentId } from "@/lib/agent-schemas";
import { getLatestProject, getProject } from "@/lib/agents.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/command-center")({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  component: CommandCenter,
});

function CommandCenter() {
  const { projectId: searchProjectId } = Route.useSearch();
  const [reviewing, setReviewing] = useState<AgentId | null>(null);
  const qc = useQueryClient();
  const latestFn = useServerFn(getLatestProject);
  const projectFn = useServerFn(getProject);

  const latest = useQuery({
    queryKey: ["latest-project"],
    queryFn: () => latestFn(),
    enabled: !searchProjectId,
  });
  const projectId = searchProjectId ?? latest.data?.id ?? null;

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

  // Realtime updates for this project
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

  if (!projectId) {
    return (
      <div className="glass-panel mx-auto max-w-lg mt-16 p-10 text-center">
        <h2 className="font-display text-2xl font-bold">No active mission</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Head to Start Business to deploy your AI team.
        </p>
        <Link
          to="/dashboard/start"
          className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Start a mission
        </Link>
      </div>
    );
  }

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
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// MISSION CONTROL</div>
        <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold tracking-tight">
          Current mission: <span className="text-primary">"{mission}"</span>
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Your AI team is on the job. Review and approve every deliverable.
        </p>

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
