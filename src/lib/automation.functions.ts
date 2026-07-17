import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PLATFORMS = ["instagram", "youtube", "twitter"] as const;
type Platform = (typeof PLATFORMS)[number];

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
      .select("id, title, body, hashtags, platform, scheduled_at, status, published_at, project_id, created_at, updated_at, projects!inner(user_id, mission, title)")
      .eq("projects.user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listProjectsWithMarketing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: projects } = await context.supabase
      .from("projects")
      .select("id, mission, title, created_at")
      .order("created_at", { ascending: false });
    if (!projects?.length) return [];
    const { data: tasks } = await context.supabase
      .from("agent_tasks")
      .select("project_id, deliverable, status")
      .in("project_id", projects.map((p) => p.id))
      .eq("agent_id", "marketing");
    const map = new Map((tasks ?? []).map((t) => [t.project_id, t]));
    return projects
      .map((p) => ({ ...p, marketing: map.get(p.id) ?? null }))
      .filter((p) => p.marketing && (p.marketing.deliverable as any)?.posts?.length);
  });

async function assertProjectOwnership(supabase: any, userId: string, projectId: string) {
  const { data } = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Project not found");
}

async function assertPostOwnership(supabase: any, userId: string, postId: string) {
  const { data } = await supabase
    .from("posts")
    .select("id, project_id, projects!inner(user_id)")
    .eq("id", postId)
    .maybeSingle();
  if (!data || (data as any).projects.user_id !== userId) throw new Error("Post not found");
  return data;
}

export const generatePostsFromMarketing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertProjectOwnership(context.supabase, context.userId, data.projectId);
    const { data: task } = await context.supabase
      .from("agent_tasks")
      .select("deliverable")
      .eq("project_id", data.projectId)
      .eq("agent_id", "marketing")
      .maybeSingle();
    const posts = ((task?.deliverable as any)?.posts ?? []) as Array<{ time?: string; headline?: string; body?: string; tags?: string[] }>;
    if (!posts.length) throw new Error("No marketing posts to import yet.");
    const platforms: Platform[] = ["instagram", "twitter", "youtube"];
    const rows = posts.map((p, i) => ({
      project_id: data.projectId,
      title: p.headline ?? `Post ${i + 1}`,
      body: p.body ?? "",
      hashtags: Array.isArray(p.tags) ? p.tags.slice(0, 15) : [],
      platform: platforms[i % platforms.length],
      status: "draft" as const,
    }));
    const { error } = await context.supabase.from("posts").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const updatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      postId: z.string().uuid(),
      title: z.string().max(200).optional(),
      body: z.string().max(4000).optional(),
      hashtags: z.array(z.string().max(60)).max(20).optional(),
      platform: z.enum(PLATFORMS).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPostOwnership(context.supabase, context.userId, data.postId);
    const patch: { title?: string; body?: string; hashtags?: string[]; platform?: Platform } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.body !== undefined) patch.body = data.body;
    if (data.hashtags !== undefined) patch.hashtags = data.hashtags;
    if (data.platform !== undefined) patch.platform = data.platform;
    const { error } = await context.supabase.from("posts").update(patch).eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPostOwnership(context.supabase, context.userId, data.postId);
    const { error } = await context.supabase.from("posts").delete().eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const schedulePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ postId: z.string().uuid(), scheduledAt: z.string().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPostOwnership(context.supabase, context.userId, data.postId);
    if (data.scheduledAt === null) {
      const { error } = await context.supabase
        .from("posts")
        .update({ status: "draft", scheduled_at: null })
        .eq("id", data.postId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const when = new Date(data.scheduledAt);
    if (isNaN(when.getTime())) throw new Error("Invalid schedule time");
    const { error } = await context.supabase
      .from("posts")
      .update({ status: "scheduled", scheduled_at: when.toISOString(), published_at: null })
      .eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regeneratePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ postId: z.string().uuid(), instructions: z.string().max(400).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const post = await assertPostOwnership(context.supabase, context.userId, data.postId);
    const { data: full } = await context.supabase
      .from("posts")
      .select("title, body, hashtags, platform, project_id")
      .eq("id", data.postId)
      .single();

    const { data: project } = await context.supabase
      .from("projects")
      .select("mission")
      .eq("id", (post as any).project_id)
      .single();

    const { generateText, Output } = await import("ai");
    const { z: zod } = await import("zod");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");

    const schema = zod.object({
      title: zod.string(),
      body: zod.string(),
      hashtags: zod.array(zod.string()),
    });

    const gateway = createGateway();
    const result = await generateText({
      model: gateway.chatModel(CHAT_MODEL),
      system:
        `You rewrite a single social media post for the ${full!.platform} platform. Keep the same intent but make it fresh. ` +
        `Return JSON matching the schema. Body must respect platform length (X/Twitter ≤ 260 chars, Instagram ≤ 2000, YouTube ≤ 400).`,
      prompt:
        `Business mission: ${project?.mission ?? ""}\n\n` +
        `Current post:\nTitle: ${full!.title ?? ""}\nBody: ${full!.body ?? ""}\nHashtags: ${(full!.hashtags ?? []).join(" ")}\n\n` +
        (data.instructions ? `User instructions: ${data.instructions}\n\n` : "") +
        `Rewrite it into one improved variant.`,
      output: Output.object({ schema }),
    });

    const out = (result as any).experimental_output as { title: string; body: string; hashtags: string[] };
    const { error } = await context.supabase
      .from("posts")
      .update({
        title: out.title.slice(0, 200),
        body: out.body.slice(0, 4000),
        hashtags: (out.hashtags ?? []).slice(0, 15),
      })
      .eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createBlankPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), platform: z.enum(PLATFORMS) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertProjectOwnership(context.supabase, context.userId, data.projectId);
    const { data: row, error } = await context.supabase
      .from("posts")
      .insert({ project_id: data.projectId, platform: data.platform, title: "New post", body: "", hashtags: [], status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
