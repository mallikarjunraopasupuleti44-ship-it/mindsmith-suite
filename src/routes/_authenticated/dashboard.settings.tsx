import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { UserCircle2, Building2, ShieldAlert, Mail, KeyRound, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateProfile } from "@/lib/profile.functions";
import { requestEmailChange, deleteAccount } from "@/lib/account.functions";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

const INDUSTRIES = [
  "Retail & E-commerce", "Food & Beverage", "SaaS & Technology", "Health & Wellness",
  "Professional Services", "Education", "Creative & Media", "Manufacturing",
  "Real Estate", "Hospitality", "Nonprofit", "Other",
];

const TIMEZONES = [
  "UTC", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Sao_Paulo", "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Madrid",
  "Africa/Cairo", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Bangkok",
  "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
];

function SettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => getFn() });

  if (isLoading) return <div className="glass p-6 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Settings</div>
        <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight">Account & Workspace</h1>
        <p className="mt-2 text-sm text-slate-500">
          Personal info lives in <Link to="/dashboard/profile" className="text-primary hover:underline">Profile</Link>.
        </p>
      </div>

      <BusinessSection profile={data?.profile} onSaved={() => qc.invalidateQueries({ queryKey: ["my-profile"] })} />
      <AccountSection email={data?.email ?? null} />
      <DangerZone username={data?.profile?.username ?? ""} />
    </div>
  );
}

function BusinessSection({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const updateFn = useServerFn(updateProfile);
  const [companyName, setCompanyName] = useState(profile?.company_name ?? "");
  const [industry, setIndustry] = useState(profile?.industry ?? "");
  const [industryOther, setIndustryOther] = useState(!INDUSTRIES.includes(profile?.industry ?? "") && profile?.industry ? profile.industry : "");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const industryValue = industry === "Other" ? industryOther.trim() : industry;
      return updateFn({ data: {
        company_name: companyName.trim() || null,
        industry: industryValue || null,
        timezone: timezone || null,
      }});
    },
    onSuccess: onSaved,
  });

  return (
    <section className="glass-panel p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Business / Workspace</h2>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        This context is passed into every agent's prompt — not just cosmetic.
      </p>

      <Field label="Company name">
        <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
          className="input" placeholder="Acme Coffee Co." />
      </Field>

      <Field label="Industry">
        <select value={INDUSTRIES.includes(industry) ? industry : (industry ? "Other" : "")}
          onChange={(e) => setIndustry(e.target.value)}
          className="input">
          <option value="">Select an industry…</option>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        {industry === "Other" && (
          <input value={industryOther} onChange={(e) => setIndustryOther(e.target.value)}
            className="input mt-2" placeholder="Describe your industry" />
        )}
      </Field>

      <Field label="Timezone">
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="input">
          <option value="">Select a timezone…</option>
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="btn-primary">{mutation.isPending ? "Saving…" : "Save changes"}</button>
        {mutation.isSuccess && <span className="text-xs text-emerald-600">Saved ✓</span>}
        {mutation.isError && <span className="text-xs text-rose-600">{(mutation.error as Error).message}</span>}
      </div>
    </section>
  );
}

function AccountSection({ email }: { email: string | null }) {
  const emailFn = useServerFn(requestEmailChange);
  const [newEmail, setNewEmail] = useState("");
  const [sentEmail, setSentEmail] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const emailMut = useMutation({
    mutationFn: async () => emailFn({ data: { email: newEmail.trim() } }),
    onSuccess: () => { setSentEmail(true); setNewEmail(""); },
  });

  const sendReset = async () => {
    setResetError(null);
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) setResetError(error.message); else setResetSent(true);
  };

  return (
    <section className="glass-panel p-6 space-y-6">
      <div className="flex items-center gap-3">
        <UserCircle2 className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Account & Security</h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Mail className="h-4 w-4" /> Current email
        </div>
        <div className="text-sm text-slate-500">{email ?? "—"}</div>
        <div className="flex gap-2">
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@example.com" className="input flex-1" />
          <button onClick={() => emailMut.mutate()} disabled={!newEmail || emailMut.isPending}
            className="btn-primary">Change email</button>
        </div>
        {sentEmail && <p className="text-xs text-emerald-600">Check your new inbox to confirm the change.</p>}
        {emailMut.isError && <p className="text-xs text-rose-600">{(emailMut.error as Error).message}</p>}
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-200/60">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <KeyRound className="h-4 w-4" /> Password
        </div>
        <p className="text-xs text-slate-500">We'll email you a secure reset link.</p>
        <button onClick={sendReset} className="btn-secondary" disabled={resetSent}>
          {resetSent ? "Reset link sent" : "Send password reset email"}
        </button>
        {resetError && <p className="text-xs text-rose-600">{resetError}</p>}
      </div>
    </section>
  );
}

function DangerZone({ username }: { username: string }) {
  const navigate = useNavigate();
  const deleteFn = useServerFn(deleteAccount);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const mut = useMutation({
    mutationFn: async () => deleteFn({ data: { confirmUsername: typed } }),
    onSuccess: async () => {
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
    },
  });

  return (
    <section className="glass-panel p-6 space-y-4 border border-rose-200/60">
      <div className="flex items-center gap-3 text-rose-600">
        <ShieldAlert className="h-5 w-5" />
        <h2 className="font-display text-xl font-bold">Danger zone</h2>
      </div>
      <p className="text-sm text-slate-600">
        Permanently delete your account, projects, agent output, and uploaded documents. This cannot be undone.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100">
          <Trash2 className="h-4 w-4" /> Delete account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-600">Type your username <span className="font-mono text-rose-600">@{username}</span> to confirm.</p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className="input" placeholder={username} />
          <div className="flex gap-2">
            <button onClick={() => mut.mutate()} disabled={typed !== username || mut.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {mut.isPending ? "Deleting…" : "Permanently delete"}
            </button>
            <button onClick={() => { setOpen(false); setTyped(""); }} className="btn-secondary">Cancel</button>
          </div>
          {mut.isError && <p className="text-xs text-rose-600">{(mut.error as Error).message}</p>}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</label>
      {children}
    </div>
  );
}
