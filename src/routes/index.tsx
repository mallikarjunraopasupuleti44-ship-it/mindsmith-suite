import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Rocket, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackgroundOrbs } from "@/components/BackgroundOrbs";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const cta = signedIn ? "/dashboard/start" : "/auth";
  const ctaLabel = signedIn ? "Open dashboard" : "Get started";

  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />

      <header className="relative z-10 mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white font-bold" style={{ background: "linear-gradient(135deg, #5B4FE9, #8B5CF6)" }}>A</div>
          <div className="font-display text-lg font-bold tracking-tight">Aura AI</div>
        </Link>
        <Link
          to={signedIn ? "/dashboard/start" : "/auth"}
          className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md hover:opacity-90"
        >
          {signedIn ? "Dashboard" : "Sign in"}
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 py-16 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Your AI co-founder</div>
        <h1 className="mt-4 font-display text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          Deploy a team of AI agents on your business idea.
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-slate-600">
          Type your idea. Aura AI dispatches five specialists — planner, marketer, financial analyst, ops manager, web designer — to turn it into a real plan, campaigns, financials, SOPs and a landing page.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={cta}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-primary/40 transition-all"
          >
            <Rocket className="h-4 w-4" />
            {ctaLabel}
          </Link>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3 text-left">
          {[
            { icon: Users, title: "Five specialists", body: "Planner, Marketing, Finance, Operations, Website — each ships a real deliverable." },
            { icon: Sparkles, title: "Grounded in you", body: "Upload documents in Knowledge and every agent references your real business." },
            { icon: Rocket, title: "You approve", body: "Every deliverable comes to you for review. You're the CEO." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 font-display font-semibold">{title}</div>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
