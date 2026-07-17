import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Instagram, Youtube, Twitter } from "lucide-react";
import { StatsRow } from "@/components/StatsRow";
import { TabSwitcher, type TabKey } from "@/components/TabSwitcher";
import { AgentCard } from "@/components/AgentCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ReviewModal } from "@/components/ReviewModal";
import { AGENTS } from "@/lib/agents";
import { useMissionStore, type AgentId } from "@/lib/mission-store";

export const Route = createFileRoute("/dashboard/command-center")({
  component: CommandCenter,
});

function CommandCenter() {
  const [tab, setTab] = useState<TabKey>("command");
  const [reviewing, setReviewing] = useState<AgentId | null>(null);
  const mission = useMissionStore((s) => s.mission);
  const agentsActive = useMissionStore((s) => s.stats.agentsActive);

  if (!mission) {
    return (
      <div className="glass-panel mx-auto max-w-lg mt-16 p-10 text-center">
        <h2 className="font-display text-2xl font-bold">No active mission</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Head to Start Business to deploy your AI team.
        </p>
        <Link
          to="/dashboard/start"
          className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Start a mission
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {reviewing && <ReviewModal agentId={reviewing} onClose={() => setReviewing(null)} />}

      <div className="glass-panel p-8 animate-rise-in">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// MISSION CONTROL</div>
        <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold tracking-tight">
          Current mission: <span className="text-primary">"{mission}"</span>
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Your AI team is on the job — business plan, campaigns, financials, operations and a live
          landing page. Review and approve every deliverable.
        </p>

        <div className="mt-6 flex flex-col md:flex-row items-stretch gap-2 rounded-2xl bg-white/40 border border-slate-200/60 p-2">
          <div className="flex-1 px-4 py-3 text-sm text-slate-700">{mission}</div>
          <button
            disabled
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary/15 px-6 py-3 text-sm font-semibold text-primary pulse-violet"
          >
            <span className="h-2 w-2 rounded-full bg-primary pulse-dot" />
            {agentsActive > 0 ? "Team working…" : "All deliverables ready"}
          </button>
        </div>
      </div>

      <StatsRow />

      <TabSwitcher value={tab} onChange={setTab} />

      {tab === "command" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4 md:grid-cols-2">
            {AGENTS.map((a, i) => (
              <AgentCard key={a.id} agentId={a.id} onReview={setReviewing} delay={i * 60} />
            ))}
          </div>
          <div className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]">
            <ActivityFeed />
          </div>
        </div>
      )}

      {tab === "team" && <TeamTab onReview={setReviewing} />}
      {tab === "automation" && <AutomationTab />}
    </div>
  );
}

function TeamTab({ onReview }: { onReview: (id: AgentId) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Your AI Workforce</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Hire, edit, pause or remove employees. You are the CEO.
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md hover:opacity-90 hover:-translate-y-0.5 transition-all">
          <Plus className="h-4 w-4" />
          Hire Employee
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AGENTS.map((a, i) => (
          <div key={a.id} className="relative">
            <div className="absolute right-4 top-4 z-10">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                ○ Core team
              </span>
            </div>
            <AgentCard agentId={a.id} onReview={onReview} delay={i * 60} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomationTab() {
  const channels = [
    { name: "Instagram", icon: Instagram, color: "#EC4899" },
    { name: "YouTube", icon: Youtube, color: "#EF4444" },
    { name: "X", icon: Twitter, color: "#0EA5E9" },
  ];
  const steps = [
    { n: 1, label: "Marketing Agent generates" },
    { n: 2, label: "Owner approves" },
    { n: 3, label: "Scheduler queues" },
    { n: 4, label: "Auto-publish to channels" },
  ];
  const posts = [
    { title: "Something's coming.", time: "Tue 9:00 AM" },
    { title: "Meet the team.", time: "Thu 6:00 PM" },
    { title: "First taste.", time: "Sat 11:00 AM" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold">Automation Hub</h2>
        <p className="text-sm text-muted-foreground mt-1">Connect channels and let approved posts publish on schedule.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {channels.map((c) => (
          <div key={c.name} className="glass p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${c.color}15`, color: c.color }}>
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">Not connected</div>
              </div>
            </div>
            <button className="rounded-2xl border border-input bg-white/60 px-4 py-2 text-sm font-medium hover:bg-white/80">
              Connect
            </button>
          </div>
        ))}
      </div>

      <div className="glass-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">// PIPELINE</div>
            <h3 className="font-display text-lg font-semibold">Publishing Workflow</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="font-mono text-xs text-muted-foreground">0 / 6 published</div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium">Run automation</span>
              <span className="relative inline-block h-6 w-11 rounded-full bg-slate-300">
                <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
              </span>
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-col md:flex-row items-stretch gap-2">
          {steps.map((s, i) => (
            <div key={s.n} className="flex-1 flex items-center gap-2">
              <div className="glass-pill flex-1 flex items-center gap-3 px-4 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary font-mono text-xs font-semibold">
                  {s.n}
                </span>
                <span className="text-sm">{s.label}</span>
              </div>
              {i < steps.length - 1 && <span className="hidden md:inline text-slate-400">→</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="font-display text-lg font-semibold">Approved posts</h3>
        <div className="mt-4 space-y-2">
          {posts.map((p) => (
            <div key={p.title} className="flex items-center justify-between rounded-2xl bg-white/50 border border-slate-200/60 px-4 py-3">
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="font-mono text-xs text-muted-foreground">Scheduled {p.time}</div>
              </div>
              <button className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                Publish now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
