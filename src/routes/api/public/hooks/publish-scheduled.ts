import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/publish-scheduled")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from("posts")
          .update({ status: "published", published_at: nowIso })
          .eq("status", "scheduled")
          .lte("scheduled_at", nowIso)
          .select("id");
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return Response.json({ ok: true, published: data?.length ?? 0 });
      },
    },
  },
});
