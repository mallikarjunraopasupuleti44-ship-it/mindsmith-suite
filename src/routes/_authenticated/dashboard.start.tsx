import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Rocket } from "lucide-react";
import { MissionBriefing } from "@/components/MissionBriefing";
import { startMission, runAgent } from "@/lib/agents.functions";

export const Route = createFileRoute("/_authenticated/dashboard/start")({
  validateSearch: z.object({ seed: z.string().optional() }),
  component: StartPage,
});

const EXAMPLES = [
  "A neighborhood specialty bakery",
  "A weekend coffee subscription for offices",
  "A boutique fitness studio for busy parents",
  "An artisan candle brand for gifting",
];

const AGENTS = ["planner", "marketing", "finance", "operations", "website"] as const;

function StartPage() {
  const { seed } = Route.useSearch();
  const [input, setInput] = useState("");
  const [briefingFor, setBriefingFor] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const start = useServerFn(startMission);
  const run = useServerFn(runAgent);

  useEffect(() => { if (seed) setInput(seed + " "); }, [seed]);

  const mutation = useMutation({
    mutationFn: async (mission: string) => {
      const { projectId } = await start({ data: { mission } });
      void (async () => {
        try {
          await run({ data: { projectId, agentId: "planner" } });
          await Promise.all(
            AGENTS.filter((a) => a !== "planner").map((agentId) =>
              run({ data: { projectId, agentId } }).catch((e) => console.error(agentId, e)),
            ),
          );
        } catch (e) {
          console.error("planner failed", e);
        } finally {
          qc.invalidateQueries({ queryKey: ["project", projectId] });
        }
      })();
      return projectId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["latest-project"] });
      navigate({ to: "/dashboard" });
    },
  });

  const deploy = () => {
    const mission = input.trim();
    if (!mission) return;
    setBriefingFor(mission);
  };

  const onBriefingDone = () => {
    if (!briefingFor) return;
    mutation.mutate(briefingFor);
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
          analysis, operations and a live landing page. Upload documents in{" "}
          <span className="text-primary font-medium">Knowledge</span> so your team can reference
          your real business.
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
          disabled={!input.trim() || mutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <Rocket className="h-4 w-4" />
          {mutation.isPending ? "Deploying…" : "Deploy AI Team"}
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

      {mutation.isError && (
        <div className="glass-panel border border-red-200 p-4 text-sm text-red-600">
          {(mutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
