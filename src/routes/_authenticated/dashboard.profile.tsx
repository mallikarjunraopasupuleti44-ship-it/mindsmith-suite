import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Camera, Pencil, Check, X, Rocket, CheckCircle2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateProfile, getQuickStats } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyProfile);
  const statsFn = useServerFn(getQuickStats);

  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => getFn() });
  const statsQ = useQuery({ queryKey: ["quick-stats"], queryFn: () => statsFn() });

  if (profileQ.isLoading) return <div className="glass p-6 text-sm text-slate-500">Loading…</div>;
  const p = profileQ.data?.profile;
  const email = profileQ.data?.email;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-profile"] });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Profile</div>
        <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight">Your profile</h1>
      </div>

      <section className="glass-panel p-6 flex flex-col md:flex-row items-start gap-6">
        <AvatarUpload userId={p?.id} currentPath={p?.avatar_url} onChange={invalidate} />
        <div className="flex-1 space-y-4">
          <UsernameEditor initial={p?.username ?? ""} onSaved={invalidate} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Email</div>
            <div className="mt-1 flex items-center gap-3 text-sm">
              <span className="text-slate-700">{email}</span>
              <Link to="/dashboard/settings" className="text-xs text-primary hover:underline">Change in Settings →</Link>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Member since</div>
            <div className="mt-1 text-sm text-slate-700">
              {p?.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Rocket} label="Missions launched" value={statsQ.data?.missionsLaunched ?? 0} />
        <StatCard icon={CheckCircle2} label="Deliverables approved" value={statsQ.data?.deliverablesApproved ?? 0} />
        <StatCard icon={FileText} label="Documents uploaded" value={statsQ.data?.documentsUploaded ?? 0} />
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="glass p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 font-display text-3xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function UsernameEditor({ initial, onSaved }: { initial: string; onSaved: () => void }) {
  const updateFn = useServerFn(updateProfile);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    try {
      await updateFn({ data: { username: value.trim() } });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Username</div>
      {!editing ? (
        <div className="mt-1 flex items-center gap-3">
          <span className="text-lg font-display font-semibold">@{initial}</span>
          <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-primary">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            className="input max-w-xs" />
          <button onClick={save} className="rounded-lg bg-primary p-2 text-white"><Check className="h-4 w-4" /></button>
          <button onClick={() => { setEditing(false); setValue(initial); setErr(null); }} className="rounded-lg bg-slate-200 p-2"><X className="h-4 w-4" /></button>
        </div>
      )}
      {err && <div className="mt-1 text-xs text-rose-600">{err}</div>}
    </div>
  );
}

function AvatarUpload({ userId, currentPath, onChange }: { userId?: string; currentPath?: string | null; onChange: () => void }) {
  const updateFn = useServerFn(updateProfile);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!currentPath) { setSignedUrl(null); return; }
    supabase.storage.from("avatars").createSignedUrl(currentPath, 3600).then(({ data }) => {
      setSignedUrl(data?.signedUrl ?? null);
    });
  }, [currentPath]);

  const onFile = async (file: File) => {
    if (!userId) return;
    setErr(null); setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      await updateFn({ data: { avatar_url: path } });
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setUploading(false); }
  };

  return (
    <label className="relative group cursor-pointer">
      <div className="h-28 w-28 rounded-full bg-primary/10 border border-slate-200 overflow-hidden flex items-center justify-center">
        {signedUrl ? (
          <img src={signedUrl} alt="Avatar" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-3xl text-primary">?</span>
        )}
      </div>
      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
        <Camera className="h-5 w-5 text-white" />
      </div>
      <input type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {uploading && <div className="mt-2 text-xs text-center text-slate-500">Uploading…</div>}
      {err && <div className="mt-2 text-xs text-rose-600">{err}</div>}
    </label>
  );
}
