import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AGENT_IDS = ["planner", "marketing", "finance", "operations", "website"] as const;
type AgentId = (typeof AGENT_IDS)[number];

// ==================== Queries ====================

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, mission, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getLatestProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("projects")
      .select("id, mission, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [projectRes, tasksRes, activityRes, sourcesRes] = await Promise.all([
      context.supabase.from("projects").select("*").eq("id", data.projectId).maybeSingle(),
      context.supabase.from("agent_tasks").select("*").eq("project_id", data.projectId),
      context.supabase.from("activity_events").select("*").eq("project_id", data.projectId).order("created_at", { ascending: false }).limit(80),
      context.supabase
        .from("deliverable_sources")
        .select("agent_task_id, document_id, knowledge_documents(file_name)")
        .in("agent_task_id",
          (await context.supabase.from("agent_tasks").select("id").eq("project_id", data.projectId)).data?.map(t => t.id) ?? []
        ),
    ]);
    if (projectRes.error) throw new Error(projectRes.error.message);
    return {
      project: projectRes.data,
      tasks: tasksRes.data ?? [],
      activity: activityRes.data ?? [],
      sources: sourcesRes.data ?? [],
    };
  });

// ==================== Mission start ====================

export const startMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mission: z.string().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    // Single-active-mission rule: block if there's already a project not completed/abandoned with pending tasks.
    const { data: existing } = await context.supabase
      .from("projects")
      .select("id, mission")
      .not("status", "in", "(completed,abandoned)")
      .order("created_at", { ascending: false })
      .limit(1);
    if (existing && existing.length > 0) {
      const p = existing[0];
      const { count } = await context.supabase
        .from("agent_tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", p.id)
        .neq("status", "approved");
      if ((count ?? 0) > 0) {
        const err = new Error(`You have a mission in progress: "${p.mission}". Finish reviewing it or abandon it before starting a new one.`);
        (err as any).code = "ACTIVE_MISSION_EXISTS";
        (err as any).activeProjectId = p.id;
        throw err;
      }
      // All tasks approved — auto-complete the stale project so a new mission can start.
      await context.supabase
        .from("projects")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", p.id);
    }

    const { data: project, error } = await context.supabase
      .from("projects")
      .insert({ user_id: context.userId, mission: data.mission, title: data.mission.slice(0, 80), status: "running" })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const rows = AGENT_IDS.map((id) => ({
      project_id: project.id,
      agent_id: id,
      status: "working",
    }));
    await context.supabase.from("agent_tasks").insert(rows);

    await context.supabase.from("activity_events").insert([
      { project_id: project.id, agent: "system", message: `Mission received: "${data.mission}"` },
      { project_id: project.id, agent: "system", message: "Assembling AI workforce…" },
      ...AGENT_IDS.map((id) => ({
        project_id: project.id,
        agent: id,
        message: descriptionFor(id),
      })),
    ]);

    return { projectId: project.id as string };
  });

function descriptionFor(id: AgentId): string {
  return {
    planner: "Analyzing business concept and brand direction",
    marketing: "Drafting campaign strategy and voice",
    finance: "Modeling startup costs and 12-month projections",
    operations: "Compiling supplier checklist and SOPs",
    website: "Generating landing page from brand identity",
  }[id];
}

// ==================== Agent runner ====================

export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      projectId: z.string().uuid(),
      agentId: z.enum(AGENT_IDS),
      language: z.enum(["english", "hindi", "telugu"]).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { runAgentImpl } = await import("./agents-runner.server");
    return runAgentImpl(context.supabase, context.userId, data.projectId, data.agentId, data.language);
  });

export const approveDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: task } = await context.supabase.from("agent_tasks").select("*, projects(id)").eq("id", data.taskId).maybeSingle();
    if (!task) throw new Error("Task not found");
    await context.supabase.from("agent_tasks").update({ status: "approved" }).eq("id", data.taskId);
    await context.supabase.from("activity_events").insert({
      project_id: task.project_id,
      agent: task.agent_id,
      message: `${task.deliverable_title ?? "Deliverable"} approved by CEO`,
    });
    return { ok: true };
  });

export const requestRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: task } = await context.supabase.from("agent_tasks").select("*").eq("id", data.taskId).maybeSingle();
    if (!task) throw new Error("Task not found");
    await context.supabase.from("agent_tasks").update({ status: "working", error: null }).eq("id", data.taskId);
    await context.supabase.from("activity_events").insert({
      project_id: task.project_id,
      agent: task.agent_id,
      message: `Revision requested — reworking ${task.deliverable_title ?? "deliverable"}`,
    });
    // Re-run
    const { runAgentImpl } = await import("./agents-runner.server");
    await runAgentImpl(context.supabase, context.userId, task.project_id, task.agent_id as AgentId);
    return { ok: true };
  });
