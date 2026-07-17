import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Instagram, Youtube, Twitter, Zap, Calendar } from "lucide-react";
import { listChannels, toggleChannel, listPosts } from "@/lib/automation.functions";

export const Route = createFileRoute("/_authenticated/dashboard/automation")({
  component: AutomationPage,
});

const PLATFORM_META: Record<string, { icon: any; label: string; hue: string }> = {
  instagram: { icon: Instagram, label: "Instagram", hue: "from-pink-500 to-purple-500" },
  youtube:   { icon: Youtube,   label: "YouTube",   hue: "from-red-500 to-orange-500" },
  twitter:   { icon: Twitter,   label: "X (Twitter)", hue: "from-slate-700 to-slate-900" },
};

function AutomationPage() {
  const qc = useQueryClient();
  const channelsFn = useServerFn(listChannels);
  const toggleFn = useServerFn(toggleChannel);
  const postsFn = useServerFn(listPosts);

  const channels = useQuery({ queryKey: ["automation-channels"], queryFn: () => channelsFn() });
  const posts = useQuery({ queryKey: ["automation-posts"], queryFn: () => postsFn() });

  const toggle = useMutation({
    mutationFn: async (v: { platform: "instagram" | "youtube" | "twitter"; connected: boolean }) =>
      toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-channels"] }),
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Automation</div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Channels & scheduled posts</h1>
        <p className="mt-2 text-sm text-slate-500">
          Connect the social channels your marketing agent should publish to. Real OAuth to each platform is coming — for now this tracks intent and stores drafts.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        {(channels.data ?? []).map((c: any) => {
          const meta = PLATFORM_META[c.platform];
          const Icon = meta.icon;
          return (
            <div key={c.platform} className="glass p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${meta.hue} text-white`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 font-display font-semibold">{meta.label}</div>
              <div className="mt-1 text-xs text-slate-500">
                {c.connected ? "Connected (placeholder)" : "Not connected"}
              </div>
              <button
                onClick={() => toggle.mutate({ platform: c.platform, connected: !c.connected })}
                className={`mt-4 w-full rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  c.connected ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-primary text-primary-foreground hover:-translate-y-0.5"
                }`}>
                {c.connected ? "Disconnect" : "Connect"}
              </button>
            </div>
          );
        })}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="font-display text-xl font-bold">Scheduled & drafted posts</h2>
        </div>
        {(posts.data ?? []).length === 0 ? (
          <div className="glass-panel p-10 text-center">
            <Zap className="mx-auto h-10 w-10 text-primary/40" />
            <p className="mt-4 text-sm text-slate-600">No posts yet. When your marketing agent produces campaign content you'll be able to schedule it here.</p>
          </div>
        ) : (
          <div className="glass-panel divide-y divide-slate-200/60">
            {posts.data!.map((p: any) => (
              <div key={p.id} className="p-5">
                <div className="flex items-center justify-between">
                  <div className="font-display font-semibold text-sm">{p.title ?? "Untitled"}</div>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">{p.status}</span>
                </div>
                {p.body && <p className="mt-2 text-sm text-slate-600 line-clamp-2">{p.body}</p>}
                <div className="mt-2 text-xs text-slate-400">
                  {p.platform ? `${p.platform} · ` : ""}
                  {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : "unscheduled"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
