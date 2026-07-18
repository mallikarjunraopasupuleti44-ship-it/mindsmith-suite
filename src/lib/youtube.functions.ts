import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getYoutubeAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { signState, googleAuthUrl } = await import("./youtube.server");
    const state = signState(context.userId);
    const redirectUri = `${data.origin}/api/public/oauth/google/callback`;
    return { url: googleAuthUrl(redirectUri, state) };
  });

export const getYoutubeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("automation_channels")
      .select("connected, provider_username, provider_account_id, token_expires_at")
      .eq("user_id", context.userId)
      .eq("platform", "youtube")
      .maybeSingle();
    return {
      connected: Boolean(data?.connected && data?.provider_account_id),
      channelTitle: data?.provider_username ?? null,
      channelId: data?.provider_account_id ?? null,
    };
  });

export const disconnectYoutube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("automation_channels")
      .update({
        connected: false, access_token: null, refresh_token: null,
        token_expires_at: null, provider_account_id: null, provider_username: null, scopes: null,
      })
      .eq("user_id", context.userId).eq("platform", "youtube");
    return { ok: true };
  });

// Records the media path (already uploaded to post-media bucket) on a post.
export const attachPostMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    postId: z.string().uuid(),
    mediaPath: z.string().min(1),
    mediaType: z.string().max(120),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: post } = await context.supabase
      .from("posts").select("id, projects!inner(user_id)").eq("id", data.postId).maybeSingle();
    if (!post || (post as any).projects.user_id !== context.userId) throw new Error("Post not found");
    const { error } = await context.supabase.from("posts")
      .update({ media_url: data.mediaPath, media_type: data.mediaType })
      .eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function publishOnePost(userId: string, postId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: post, error: postErr } = await supabaseAdmin
    .from("posts").select("*").eq("id", postId).single();
  if (postErr || !post) throw new Error("Post not found");
  if (post.platform !== "youtube") throw new Error("This publisher only handles YouTube posts");
  if (!post.media_url) throw new Error("Attach a video file to this post first");

  const { data: channel } = await supabaseAdmin
    .from("automation_channels")
    .select("id, access_token, refresh_token, token_expires_at")
    .eq("user_id", userId).eq("platform", "youtube").maybeSingle();
  if (!channel) throw new Error("YouTube is not connected");

  const { getValidAccessToken, uploadVideoToYoutube } = await import("./youtube.server");
  const accessToken = await getValidAccessToken(channel as any);

  const { data: file, error: dlErr } = await supabaseAdmin.storage.from("post-media").download(post.media_url);
  if (dlErr || !file) throw new Error(`Failed to load video: ${dlErr?.message ?? "unknown"}`);
  const videoBytes = await file.arrayBuffer();

  const description = [post.body ?? "", (post.hashtags ?? []).map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")]
    .filter(Boolean).join("\n\n");

  const uploaded = await uploadVideoToYoutube({
    accessToken,
    title: post.title ?? "Untitled",
    description,
    tags: post.hashtags ?? [],
    videoBytes,
    contentType: post.media_type || "video/mp4",
  });

  await supabaseAdmin.from("posts").update({
    status: "published",
    published_at: new Date().toISOString(),
    external_post_id: uploaded.id,
    external_url: uploaded.url,
    error: null,
  }).eq("id", postId);

  return uploaded;
}

export const publishPostNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: post } = await context.supabase
      .from("posts").select("id, projects!inner(user_id)").eq("id", data.postId).maybeSingle();
    if (!post || (post as any).projects.user_id !== context.userId) throw new Error("Post not found");
    try {
      return await publishOnePost(context.userId, data.postId);
    } catch (e: any) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("posts").update({ error: e.message ?? "publish failed" }).eq("id", data.postId);
      throw e;
    }
  });

// Called by cron. Not exported to routes — imported by the publish-scheduled hook.
export async function publishDuePostsInternal() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("posts")
    .select("id, platform, projects!inner(user_id)")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .limit(20);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const p of due ?? []) {
    if (p.platform === "youtube") {
      try {
        await publishOnePost((p as any).projects.user_id, p.id);
        results.push({ id: p.id, ok: true });
      } catch (e: any) {
        await supabaseAdmin.from("posts")
          .update({ error: e.message ?? "publish failed" }).eq("id", p.id);
        results.push({ id: p.id, ok: false, error: e.message });
      }
    } else {
      // Non-YouTube platforms: keep legacy behavior — flip to published.
      await supabaseAdmin.from("posts")
        .update({ status: "published", published_at: nowIso }).eq("id", p.id);
      results.push({ id: p.id, ok: true });
    }
  }
  return results;
}

export const generateYoutubeMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    topic: z.string().min(3).max(500),
    projectId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    let mission = "";
    if (data.projectId) {
      const { data: pj } = await context.supabase.from("projects")
        .select("mission").eq("id", data.projectId).eq("user_id", context.userId).maybeSingle();
      mission = pj?.mission ?? "";
    }
    const { generateText, Output } = await import("ai");
    const { z: zod } = await import("zod");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const schema = zod.object({
      title: zod.string(),
      description: zod.string(),
      hashtags: zod.array(zod.string()),
    });
    const gateway = createGateway();
    const result = await generateText({
      model: gateway.chatModel(CHAT_MODEL),
      system: "You write YouTube video metadata. Title ≤ 90 chars, description ≤ 1500 chars including a hook + 3-5 bullet points, 5-10 hashtags without the # prefix.",
      prompt: `${mission ? `Business context: ${mission}\n\n` : ""}Video topic: ${data.topic}\n\nReturn JSON.`,
      output: Output.object({ schema }),
    });
    const out = (result as any).output as { title: string; description: string; hashtags: string[] };
    return {
      title: out.title.slice(0, 100),
      body: out.description.slice(0, 4000),
      hashtags: (out.hashtags ?? []).slice(0, 15),
    };
  });
