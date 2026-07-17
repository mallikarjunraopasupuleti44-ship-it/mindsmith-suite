import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Rocket, PenLine, Cpu, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AGENTS } from "@/lib/agents";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function AuraMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl text-white font-bold shadow-lg shadow-primary/25"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #5B4FE9, #8B5CF6)",
      }}
    >
      A
    </div>
  );
}

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const primaryHref = signedIn ? "/dashboard" : "/auth";
  const primaryLabel = signedIn ? "Open dashboard" : "Get Started";

  return (
    <div className="relative min-h-screen">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/40 border-b border-white/60">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <AuraMark size={36} />
            <div className="font-display text-lg font-bold tracking-tight">Aura AI</div>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#agents" className="hover:text-foreground transition">Features</a>
            <a href="#how" className="hover:text-foreground transition">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden sm:inline-flex rounded-2xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              to={primaryHref}
              className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:opacity-90"
            >
              {signedIn ? "Dashboard" : "Get Started"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Your AI co-founder</div>
        <h1 className="mt-4 font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] break-words">
          Deploy a team of AI agents on your business idea.
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-slate-600">
          Describe your idea and Aura AI dispatches five specialists — planner, marketer, financial
          analyst, ops manager, and web designer — to turn it into a real plan, campaigns, financials,
          SOPs and a live landing page.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={primaryHref}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-primary/40 transition-all"
          >
            <Rocket className="h-4 w-4" />
            {signedIn ? primaryLabel : "Deploy Your AI Team"}
          </Link>
        </div>
      </section>

      {/* Agents preview */}
      <section id="agents" className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// The team</div>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight">
            Meet your AI workforce
          </h2>
          <p className="mt-3 text-slate-600">
            Five specialists, each shipping a real deliverable — grounded in the documents you upload.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a) => (
            <div key={a.id} className="glass p-6">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold"
                  style={{
                    color: a.accent,
                    background: `${a.accent}15`,
                    boxShadow: `0 0 0 1px ${a.accent}25, 0 4px 20px ${a.accent}20`,
                  }}
                >
                  {a.glyph}
                </div>
                <div>
                  <div className="font-display text-base font-semibold leading-tight">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.role}</div>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-600 leading-relaxed">{a.description}</p>
              <div className="mt-4 rounded-xl bg-white/50 border border-slate-200/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Deliverable
                </div>
                <div className="mt-0.5 text-sm font-medium">{a.deliverable}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Workflow</div>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight">How it works</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: PenLine, title: "Describe your idea", body: "One sentence is enough. Add documents in Knowledge for extra context." },
            { icon: Cpu, title: "Your AI team gets to work", body: "Five agents run in parallel — plan, marketing, finance, ops, website." },
            { icon: CheckCircle2, title: "Review and approve every deliverable", body: "Each result lands for review. You approve, request revisions, or export." },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="glass p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-mono text-sm font-semibold">
                  {i + 1}
                </div>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4 font-display font-semibold">{title}</div>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <div className="glass-panel p-10">
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
            Ready to meet your co-founder?
          </h2>
          <p className="mt-2 text-slate-600">Sign up in seconds. No credit card required.</p>
          <Link
            to={primaryHref}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5"
          >
            <Rocket className="h-4 w-4" />
            {signedIn ? "Open dashboard" : "Deploy Your AI Team"}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/60 bg-white/40 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <AuraMark size={32} />
            <div className="font-display font-bold tracking-tight">Aura AI</div>
          </Link>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#agents" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <Link to="/auth" className="hover:text-foreground">Log in</Link>
          </div>
          <div className="text-xs text-slate-400">© {new Date().getFullYear()} Aura AI</div>
        </div>
      </footer>
    </div>
  );
}
