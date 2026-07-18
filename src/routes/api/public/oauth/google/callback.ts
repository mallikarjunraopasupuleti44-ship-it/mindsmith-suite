import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/oauth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        const dashUrl = `${url.origin}/dashboard/automation`;

        if (err) return Response.redirect(`${dashUrl}?youtube=error&reason=${encodeURIComponent(err)}`, 302);
        if (!code || !state) return Response.redirect(`${dashUrl}?youtube=error&reason=missing_code`, 302);

        const { verifyState, exchangeCode, fetchChannelInfo } = await import("@/lib/youtube.server");
        const stateData = verifyState(state);
        if (!stateData) return Response.redirect(`${dashUrl}?youtube=error&reason=bad_state`, 302);

        try {
          const redirectUri = `${url.origin}/api/public/oauth/google/callback`;
          const tokens = await exchangeCode(code, redirectUri);
          const channel = await fetchChannelInfo(tokens.access_token);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
          const { error } = await supabaseAdmin.from("automation_channels").upsert(
            {
              user_id: stateData.userId,
              platform: "youtube",
              connected: true,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token ?? null,
              token_expires_at: expiresAt,
              provider_account_id: channel?.id ?? null,
              provider_username: channel?.title ?? null,
              scopes: tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,platform" },
          );
          if (error) throw new Error(error.message);
          return Response.redirect(`${dashUrl}?youtube=connected`, 302);
        } catch (e: any) {
          return Response.redirect(`${dashUrl}?youtube=error&reason=${encodeURIComponent(e.message ?? "unknown")}`, 302);
        }
      },
    },
  },
});
