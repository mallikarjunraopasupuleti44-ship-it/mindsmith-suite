import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listMissionHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: projects, error } = await context.supabase
      .from("projects")
      .select("id, mission, title, status, created_at, completed_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = projects ?? [];
    if (list.length === 0) return [];

    const { data: taskCounts } = await context.supabase
      .from("agent_tasks")
      .select("project_id, status")
      .in("project_id", list.map((p) => p.id));

    const approvedByProject = new Map<string, number>();
    for (const t of taskCounts ?? []) {
      if (t.status === "approved") {
        approvedByProject.set(t.project_id, (approvedByProject.get(t.project_id) ?? 0) + 1);
      }
    }
    return list.map((p) => ({
      ...p,
      approvedCount: approvedByProject.get(p.id) ?? 0,
    }));
  });

export const getActiveMission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Active = latest project that isn't completed or abandoned AND still has non-approved tasks
    const { data: projects } = await context.supabase
      .from("projects")
      .select("id, mission, title, status, created_at")
      .not("status", "in", "(completed,abandoned)")
      .order("created_at", { ascending: false })
      .limit(1);
    const p = projects?.[0];
    if (!p) return null;
    const { count } = await context.supabase
      .from("agent_tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", p.id)
      .neq("status", "approved");
    if ((count ?? 0) === 0) return null;
    return p;
  });

export const abandonMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("projects")
      .update({ status: "abandoned", completed_at: new Date().toISOString() })
      .eq("id", data.projectId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("projects")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", data.projectId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
