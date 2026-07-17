import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [
      projectsRes,
      tasksRes,
      postsRes,
      docsRes,
      employeesRes,
      activityRes,
      profileRes,
    ] = await Promise.all([
      supabase.from("projects").select("id, mission, title, status, created_at, completed_at").eq("user_id", userId),
      supabase.from("agent_tasks").select("agent_id, status, project_id, updated_at, projects!inner(user_id)").eq("projects.user_id", userId),
      supabase.from("posts").select("id, platform, status, created_at, published_at, scheduled_at, projects!inner(user_id)").eq("projects.user_id", userId),
      supabase.from("knowledge_documents").select("id, status, category, uploaded_at").eq("user_id", userId),
      supabase.from("ai_employees").select("id, name, role_title").eq("is_active", true),
      supabase.from("activity_events").select("id, created_at, agent, message, projects!inner(user_id)").eq("projects.user_id", userId).order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("created_at").eq("id", userId).maybeSingle(),
    ]);

    const projects = projectsRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const posts = postsRes.data ?? [];
    const docs = docsRes.data ?? [];
    const employees = employeesRes.data ?? [];
    const activity = activityRes.data ?? [];

    const now = Date.now();
    const day = 86_400_000;

    // 30-day activity buckets
    const buckets: { date: string; missions: number; deliverables: number; posts: number; docs: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * day);
      const key = d.toISOString().slice(0, 10);
      buckets.push({ date: key, missions: 0, deliverables: 0, posts: 0, docs: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.date, i]));
    const bump = (iso: string | null, k: "missions" | "deliverables" | "posts" | "docs") => {
      if (!iso) return;
      const key = iso.slice(0, 10);
      const i = idx.get(key);
      if (i !== undefined) buckets[i][k]++;
    };
    projects.forEach((p) => bump(p.created_at, "missions"));
    tasks.filter((t) => t.status === "approved").forEach((t) => bump(t.updated_at, "deliverables"));
    posts.forEach((p) => bump(p.created_at, "posts"));
    docs.forEach((d) => bump(d.uploaded_at, "docs"));

    const missionsCompleted = projects.filter((p) => p.status === "completed").length;
    const deliverablesApproved = tasks.filter((t) => t.status === "approved").length;
    const deliverablesTotal = tasks.length;
    const postsByStatus = {
      draft: posts.filter((p) => p.status === "draft").length,
      scheduled: posts.filter((p) => p.status === "scheduled").length,
      published: posts.filter((p) => p.status === "published").length,
    };
    const postsByPlatform = {
      instagram: posts.filter((p) => p.platform === "instagram").length,
      twitter: posts.filter((p) => p.platform === "twitter").length,
      youtube: posts.filter((p) => p.platform === "youtube").length,
    };
    const docsByStatus = {
      indexed: docs.filter((d) => d.status === "indexed").length,
      processing: docs.filter((d) => d.status === "processing").length,
      failed: docs.filter((d) => d.status === "failed").length,
    };
    const docsByCategory: Record<string, number> = {};
    docs.forEach((d) => { const k = d.category ?? "other"; docsByCategory[k] = (docsByCategory[k] ?? 0) + 1; });

    // Streak (consecutive days with any activity in last 30 days ending today)
    let streak = 0;
    for (let i = buckets.length - 1; i >= 0; i--) {
      const b = buckets[i];
      const any = b.missions + b.deliverables + b.posts + b.docs > 0;
      if (any) streak++; else break;
    }

    const joinedAt = profileRes.data?.created_at ?? null;
    const daysActive = joinedAt ? Math.max(1, Math.floor((now - new Date(joinedAt).getTime()) / day)) : null;

    return {
      totals: {
        missions: projects.length,
        missionsCompleted,
        deliverablesTotal,
        deliverablesApproved,
        posts: posts.length,
        knowledgeDocs: docs.length,
        employees: employees.length,
        activityEvents: activity.length,
      },
      postsByStatus,
      postsByPlatform,
      docsByStatus,
      docsByCategory,
      timeline: buckets,
      streak,
      daysActive,
      joinedAt,
      recentActivity: activity.slice(0, 12).map((a) => ({
        id: a.id, agent: a.agent, message: a.message, created_at: a.created_at,
      })),
    };
  });
