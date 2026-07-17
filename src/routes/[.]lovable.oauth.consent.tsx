import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Beta auth.oauth namespace — locally typed to keep TS happy.
type AuthorizationDetails = {
  client?: { name?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
};
const oauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: any }>;
    approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: any }>;
    denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: any }>;
  };
}).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-panel max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-bold mb-2">Authorization error</h1>
        <p className="text-sm text-slate-600">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "an app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message ?? "Something went wrong.");
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-panel max-w-md w-full p-8">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-primary">// Agent integration</div>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
          Connect {clientName} to Aura AI
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {clientName} will be able to act as you — read your missions, knowledge base, and start new missions on your behalf.
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-xl border border-input bg-white/60 px-4 py-2.5 text-sm font-semibold hover:bg-white/90 disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
