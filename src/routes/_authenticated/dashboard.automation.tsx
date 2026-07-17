import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Instagram, Youtube, Twitter, Zap, Calendar, Sparkles, Pencil, Trash2, RefreshCw, Plus, Info } from "lucide-react";
import {
  listChannels, toggleChannel, listPosts, listProjectsWithMarketing,
  generatePostsFromMarketing, updatePost, deletePost, schedulePost, regeneratePost, createBlankPost,
} from "@/lib/automation.functions";

export const Route = createFileRoute("/_authenticated/dashboard/automation")({
  component: AutomationPage,
});

const PLATFORM_META: Record<string, { icon: any; label: string; hue: string }> = {
  instagram: { icon: Instagram, label: "Instagram", hue: "from-pink-500 to-purple-500" },
  youtube:   { icon: Youtube,   label: "YouTube",   hue: "from-red-500 to-orange-500" },
  twitter:   { icon: Twitter,   label: "X (Twitter)", hue: "from-slate-700 to-slate-900" },
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AutomationPage() {
  const qc = useQueryClient();
  const channelsFn = useServerFn(listChannels);
  const toggleFn = useServerFn(toggleChannel);
  const postsFn = useServerFn(listPosts);
  const projectsFn = useServerFn(listProjectsWithMarketing);
  const genFn = useServerFn(generatePostsFromMarketing);
  const updateFn = useServerFn(updatePost);
  const deleteFn = useServerFn(deletePost);
  const scheduleFn = useServerFn(schedulePost);
  const regenFn = useServerFn(regeneratePost);
  const createBlankFn = useServerFn(createBlankPost);

  const channels = useQuery({ queryKey: ["automation-channels"], queryFn: () => channelsFn() });
  const posts = useQuery({ queryKey: ["automation-posts"], queryFn: () => postsFn() });
  const projects = useQuery({ queryKey: ["automation-projects"], queryFn: () => projectsFn() });

  const [selectedProject, setSelectedProject] = useState<string>("");
  const [editing, setEditing] = useState<any | null>(null);
  const [scheduling, setScheduling] = useState<any | null>(null);
  const [regenInstr, setRegenInstr] = useState<Record<string, string>>({});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["automation-posts"] });
  };

  const toggle = useMutation({
    mutationFn: async (v: { platform: "instagram" | "youtube" | "twitter"; connected: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-channels"] }),
  });

  const generate = useMutation({
    mutationFn: async (projectId: string) => genFn({ data: { projectId } }),
    onSuccess: invalidate,
  });

  const save = useMutation({
    mutationFn: async (v: { postId: string; patch: any }) => updateFn({ data: { postId: v.postId, ...v.patch } }),
    onSuccess: () => { invalidate(); setEditing(null); },
  });

  const remove = useMutation({
    mutationFn: async (postId: string) => deleteFn({ data: { postId } }),
    onSuccess: invalidate,
  });

  const setSchedule = useMutation({
    mutationFn: async (v: { postId: string; scheduledAt: string | null }) => scheduleFn({ data: v }),
    onSuccess: () => { invalidate(); setScheduling(null); },
  });

  const regen = useMutation({
    mutationFn: async (v: { postId: string; instructions?: string }) => regenFn({ data: v }),
    onSuccess: invalidate,
  });

  const createBlank = useMutation({
    mutationFn: async (v: { projectId: string; platform: "instagram" | "youtube" | "twitter" }) => createBlankFn({ data: v }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Automation</div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Channels & scheduled posts</h1>
        <p className="mt-2 text-sm text-slate-500">
          Import drafts from your marketing agent, edit them, and schedule when they should go live.
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
                {c.connected ? "Marked connected" : "Not connected"}
              </div>
              <button
                onClick={() => toggle.mutate({ platform: c.platform, connected: !c.connected })}
                className={`mt-4 w-full rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  c.connected ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-primary text-primary-foreground hover:-translate-y-0.5"
                }`}>
                {c.connected ? "Mark disconnected" : "Mark connected"}
              </button>
            </div>
          );
        })}
      </section>

      <div className="glass-panel p-4 flex items-start gap-3 text-xs text-slate-600">
        <Info className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
        <p>
          Live posting to Instagram/YouTube/X needs each platform's OAuth app and review. That's a separate setup step — for now scheduled posts auto-flip to "published" here at their scheduled time so you can test the full flow.
        </p>
      </div>

      <section className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display font-bold">Import from marketing agent</h2>
        </div>
        {(projects.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Approve a marketing deliverable first, then come back to import its posts as drafts.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm">
              <option value="">Pick a mission…</option>
              {projects.data!.map((p: any) => (
                <option key={p.id} value={p.id}>{p.title ?? p.mission}</option>
              ))}
            </select>
            <button
              onClick={() => selectedProject && generate.mutate(selectedProject)}
              disabled={!selectedProject || generate.isPending}
              className="btn-primary disabled:opacity-50">
              {generate.isPending ? "Importing…" : "Import posts"}
            </button>
            {selectedProject && (
              <>
                {(["instagram", "twitter", "youtube"] as const).map((pl) => (
                  <button
                    key={pl}
                    onClick={() => createBlank.mutate({ projectId: selectedProject, platform: pl })}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">
                    <Plus className="h-3 w-3" /> Blank {PLATFORM_META[pl].label}
                  </button>
                ))}
              </>
            )}
            {generate.isError && <span className="text-xs text-red-600">{(generate.error as Error).message}</span>}
            {generate.isSuccess && <span className="text-xs text-emerald-600">Imported {(generate.data as any).inserted} drafts.</span>}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="font-display text-xl font-bold">Posts</h2>
        </div>
        {(posts.data ?? []).length === 0 ? (
          <div className="glass-panel p-10 text-center">
            <Zap className="mx-auto h-10 w-10 text-primary/40" />
            <p className="mt-4 text-sm text-slate-600">No posts yet. Import from a mission above to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {posts.data!.map((p: any) => {
              const meta = PLATFORM_META[p.platform] ?? PLATFORM_META.twitter;
              const Icon = meta.icon;
              return (
                <div key={p.id} className="glass-panel p-5">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.hue} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-display font-semibold text-sm truncate">{p.title ?? "Untitled"}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${STATUS_STYLES[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {p.status}
                        </span>
                      </div>
                      {p.body && <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{p.body}</p>}
                      {p.hashtags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.hashtags.map((h: string) => (
                            <span key={h} className="text-[11px] text-primary bg-primary/10 rounded-full px-2 py-0.5">#{h.replace(/^#/, "")}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 text-xs text-slate-400">
                        {p.projects?.title ?? p.projects?.mission ? `${p.projects.title ?? p.projects.mission} · ` : ""}
                        {p.status === "published" && p.published_at
                          ? `published ${new Date(p.published_at).toLocaleString()}`
                          : p.scheduled_at
                            ? `scheduled ${new Date(p.scheduled_at).toLocaleString()}`
                            : "unscheduled"}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-foreground">
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button onClick={() => setScheduling(p)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-foreground">
                          <Calendar className="h-3 w-3" /> {p.status === "scheduled" ? "Reschedule" : "Schedule"}
                        </button>
                        <button
                          onClick={() => regen.mutate({ postId: p.id, instructions: regenInstr[p.id] })}
                          disabled={regen.isPending && (regen.variables as any)?.postId === p.id}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 disabled:opacity-50">
                          <RefreshCw className={`h-3 w-3 ${regen.isPending && (regen.variables as any)?.postId === p.id ? "animate-spin" : ""}`} /> Regenerate
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this post?")) remove.mutate(p.id); }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:opacity-80">
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                      <input
                        placeholder="Optional: instructions for regenerate (e.g. 'make it funnier')"
                        value={regenInstr[p.id] ?? ""}
                        onChange={(e) => setRegenInstr((s) => ({ ...s, [p.id]: e.target.value }))}
                        className="mt-2 w-full text-xs bg-transparent border-b border-dashed border-slate-200 py-1 focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {editing && (
        <EditDialog
          post={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => save.mutate({ postId: editing.id, patch })}
          saving={save.isPending}
        />
      )}

      {scheduling && (
        <ScheduleDialog
          post={scheduling}
          onClose={() => setScheduling(null)}
          onSave={(iso) => setSchedule.mutate({ postId: scheduling.id, scheduledAt: iso })}
          saving={setSchedule.isPending}
        />
      )}
    </div>
  );
}

function EditDialog({ post, onClose, onSave, saving }: { post: any; onClose: () => void; onSave: (p: any) => void; saving: boolean }) {
  const [title, setTitle] = useState(post.title ?? "");
  const [body, setBody] = useState(post.body ?? "");
  const [tags, setTags] = useState((post.hashtags ?? []).join(" "));
  const [platform, setPlatform] = useState(post.platform ?? "twitter");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold mb-4">Edit post</h3>
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-500">Platform
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="instagram">Instagram</option>
              <option value="twitter">X (Twitter)</option>
              <option value="youtube">YouTube</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500">Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold text-slate-500">Body
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold text-slate-500">Hashtags (space separated)
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button
            onClick={() => onSave({
              title, body, platform,
              hashtags: tags.split(/\s+/).map((t: string) => t.replace(/^#/, "")).filter(Boolean),
            })}
            disabled={saving}
            className="btn-primary disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleDialog({ post, onClose, onSave, saving }: { post: any; onClose: () => void; onSave: (iso: string | null) => void; saving: boolean }) {
  const [when, setWhen] = useState(toLocalInput(post.scheduled_at));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold mb-4">Schedule post</h3>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <p className="mt-2 text-xs text-slate-500">
          At the scheduled time, this post will be automatically marked as published.
        </p>
        <div className="mt-5 flex justify-between gap-2">
          <button
            onClick={() => onSave(null)}
            disabled={saving}
            className="text-xs text-rose-600 font-semibold">
            Unschedule
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
            <button
              onClick={() => when && onSave(new Date(when).toISOString())}
              disabled={saving || !when}
              className="btn-primary disabled:opacity-50">
              {saving ? "Saving…" : "Schedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
