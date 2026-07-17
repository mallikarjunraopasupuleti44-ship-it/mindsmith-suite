import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Rocket } from "lucide-react";
import { StatsRow } from "@/components/StatsRow";
import { TabSwitcher, type TabKey } from "@/components/TabSwitcher";
import { MissionBriefing } from "@/components/MissionBriefing";
import { useMissionStore } from "@/lib/mission-store";

export const Route = createFileRoute("/dashboard/start")({
  component: StartPage,
});

const EXAMPLES = [
  "A neighborhood specialty bakery",
  "A weekend coffee subscription for offices",
  "A boutique fitness studio for busy parents",
  "An artisan candle brand for gifting",
];

function StartPage() {
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<TabKey>("command");
  const [briefingFor, setBriefingFor] = useState<string | null>(null);
  const navigate = useNavigate();
  const startMission = useMissionStore((s) => s.startMission);

  const deploy = () => {
    const mission = input.trim();
    if (!mission) return;
    setBriefingFor(mission);
  };

  const onBriefingDone = () => {
    if (!briefingFor) return;
    startMission(briefingFor);
    // Kick off simulated agent progression
    const ids = ["planner", "marketing", "finance", "operations", "website"] as const;
    ids.forEach((id, i) => {
      setTimeout(() => {
        useMissionStore.getState().setAgentStatus(id, "needs_review", `${id[0].toUpperCase() + id.slice(1)} deliverable`);
        useMissionStore.getState().pushActivity({ agent: id, message: `Deliverable ready for review` });
      }, 2200 + i * 1400);
    });
    navigate({ to: "/dashboard/command-center" });
  };

  return (
    <div className="space-y-8">
      {briefingFor && <MissionBriefing mission={briefingFor} onDone={onBriefingDone} />}

      <div className="animate-rise-in">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// START A MISSION</div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">
          What business do you want to build?
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Type your idea and your AI team gets to work — business plan, social campaign, cost
          analysis, operations and a live landing page. You review and approve every deliverable.
        </p>
      </div>

      <div className="glass-pill flex flex-col md:flex-row items-stretch gap-2 p-2 animate-rise-in" style={{ animationDelay: "80ms" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && deploy()}
          placeholder="I want to start a bakery"
          className="flex-1 bg-transparent px-4 py-3 text-base outline-none placeholder:text-slate-400"
        />
        <button
          onClick={deploy}
          disabled={!input.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <Rocket className="h-4 w-4" />
          Deploy AI Team
        </button>
      </div>

      <div className="flex flex-wrap gap-2 animate-rise-in" style={{ animationDelay: "140ms" }}>
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => setInput(e)}
            className="glass-pill px-4 py-2 text-sm text-slate-600 hover:text-foreground transition"
          >
            {e}
          </button>
        ))}
      </div>

      <StatsRow />

      <TabSwitcher value={tab} onChange={setTab} />

      <div className="glass-panel p-10 text-center text-muted-foreground">
        Deploy your AI team above to activate the command center.
      </div>
    </div>
  );
}
