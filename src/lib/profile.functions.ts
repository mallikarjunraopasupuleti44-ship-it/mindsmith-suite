import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: userRes } = await context.supabase.auth.getUser();
    return {
      profile,
      email: userRes.user?.email ?? null,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      username: z.string().min(2).max(40).regex(/^[a-zA-Z0-9_]+$/).optional(),
      company_name: z.string().max(120).nullable().optional(),
      industry: z.string().max(80).nullable().optional(),
      timezone: z.string().max(80).nullable().optional(),
      avatar_url: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.username) {
      const { data: taken } = await context.supabase
        .from("profiles")
        .select("id")
        .eq("username", data.username)
        .neq("id", context.userId)
        .maybeSingle();
      if (taken) throw new Error("That username is taken");
    }
    const { error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ username: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    return { available: !row || row.id === context.userId };
  });

export const getQuickStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [missions, approved, docs] = await Promise.all([
      context.supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", context.userId),
      context.supabase
        .from("agent_tasks")
        .select("id, projects!inner(user_id)", { count: "exact", head: true })
        .eq("status", "approved")
        .eq("projects.user_id", context.userId),
      context.supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("user_id", context.userId),
    ]);
    return {
      missionsLaunched: missions.count ?? 0,
      deliverablesApproved: approved.count ?? 0,
      documentsUploaded: docs.count ?? 0,
    };
  });
