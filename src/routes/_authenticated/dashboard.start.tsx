import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Rocket, AlertTriangle, Square } from "lucide-react";
import { MissionBriefing } from "@/components/MissionBriefing";
import { MicButton } from "@/components/MicButton";
import { startMission, runAgent } from "@/lib/agents.functions";
import { getActiveMission, abandonMission } from "@/lib/history.functions";

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
  const [language, setLanguage] = useState<"english" | "hindi" | "telugu">("english");
  const [briefingFor, setBriefingFor] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const start = useServerFn(startMission);
  const run = useServerFn(runAgent);
  const activeFn = useServerFn(getActiveMission);
  const abandonFn = useServerFn(abandonMission);

  const active = useQuery({ queryKey: ["active-mission"], queryFn: () => activeFn() });

  useEffect(() => { if (seed) setInput(seed + " "); }, [seed]);

  const stoppedRef = useRef(false);
  const startedProjectRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (mission: string) => {
      stoppedRef.current = false;
      startedProjectRef.current = null;
      const { projectId } = await start({ data: { mission } });
      startedProjectRef.current = projectId;
      if (stoppedRef.current) {
        await abandonFn({ data: { projectId } }).catch(() => {});
        throw new Error("Stopped");
      }
      void (async () => {
        try {
          if (stoppedRef.current) return;
          await run({ data: { projectId, agentId: "planner", language } });
          if (stoppedRef.current) return;
          await Promise.all(
            AGENTS.filter((a) => a !== "planner").map((agentId) =>
              stoppedRef.current
                ? Promise.resolve()
                : run({ data: { projectId, agentId, language } }).catch((e: unknown) => console.error(agentId, e)),
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
      qc.invalidateQueries({ queryKey: ["active-mission"] });
      navigate({ to: "/dashboard" });
    },
  });

  const abandon = useMutation({
    mutationFn: async (projectId: string) => abandonFn({ data: { projectId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-mission"] });
      qc.invalidateQueries({ queryKey: ["latest-project"] });
    },
  });

  const deploy = () => {
    const mission = input.trim();
    if (!mission || active.data) return;
    stoppedRef.current = false;
    setBriefingFor(mission);
  };

  const stopDeployment = () => {
    stoppedRef.current = true;
    setBriefingFor(null);
    const pid = startedProjectRef.current;
    if (pid) {
      abandonFn({ data: { projectId: pid } })
        .catch(() => {})
        .finally(() => {
          startedProjectRef.current = null;
          qc.invalidateQueries({ queryKey: ["active-mission"] });
          qc.invalidateQueries({ queryKey: ["latest-project"] });
        });
    }
    mutation.reset();
  };

  const onBriefingDone = () => {
    if (!briefingFor || stoppedRef.current) return;
    mutation.mutate(briefingFor);
  };

  const hasActive = !!active.data;

  return (
    <div className="space-y-8">
      {briefingFor && <MissionBriefing mission={briefingFor} onDone={onBriefingDone} onStop={stopDeployment} />}

      {hasActive && (
        <div className="glass-panel border border-amber-300/60 bg-amber-50/40 p-5 animate-rise-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <div className="font-display font-semibold text-amber-900">You have a mission in progress</div>
              <p className="mt-1 text-sm text-slate-700">
                "{active.data!.mission}" — finish reviewing it or abandon it to start a new one.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/dashboard" className="btn-primary">Open current mission</Link>
                <button
                  onClick={() => abandon.mutate(active.data!.id)}
                  disabled={abandon.isPending}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white/60 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                  Abandon this mission
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      <div className="flex items-center gap-2 animate-rise-in" style={{ animationDelay: "60ms" }}>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500 font-mono">Response language</span>
        <div className="glass-pill flex gap-1 p-1">
          {([
            { id: "english", label: "English" },
            { id: "hindi", label: "हिन्दी" },
            { id: "telugu", label: "తెలుగు" },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setLanguage(opt.id)}
              disabled={hasActive}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                language === opt.id
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-slate-600 hover:text-foreground"
              } disabled:opacity-40`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-pill flex flex-col md:flex-row items-stretch gap-2 p-2 animate-rise-in" style={{ animationDelay: "80ms" }}>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && deploy()}
          placeholder="I want to start a bakery"
          disabled={hasActive}
          className="flex-1 bg-transparent px-4 py-3 text-base outline-none placeholder:text-slate-400 disabled:opacity-40"
        />
        <MicButton
          disabled={hasActive}
          onTranscript={(t) => setInput((v) => (v ? v + " " + t : t))}
        />
        <button
          onClick={deploy}
          disabled={!input.trim() || mutation.isPending || hasActive}
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
            disabled={hasActive}
            className="glass-pill px-4 py-2 text-sm text-slate-600 hover:text-foreground transition disabled:opacity-40"
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

