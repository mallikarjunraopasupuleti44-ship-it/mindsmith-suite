import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PLATFORMS = ["instagram", "youtube", "twitter"] as const;

export const listChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("automation_channels")
      .select("*")
      .eq("user_id", context.userId);
    const byPlatform = new Map((data ?? []).map((c) => [c.platform, c]));
    return PLATFORMS.map((p) => byPlatform.get(p) ?? {
      id: null, platform: p, connected: false, external_account_id: null, user_id: context.userId,
    });
  });

export const toggleChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ platform: z.enum(PLATFORMS), connected: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_channels")
      .upsert(
        { user_id: context.userId, platform: data.platform, connected: data.connected },
        { onConflict: "user_id,platform" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("posts")
      .select("id, title, body, hashtags, platform, scheduled_at, status, project_id, created_at, projects!inner(user_id, mission)")
      .eq("projects.user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
