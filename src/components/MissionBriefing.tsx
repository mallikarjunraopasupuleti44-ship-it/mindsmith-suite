import { useEffect, useState } from "react";
import { Square } from "lucide-react";
import { BackgroundOrbs } from "./BackgroundOrbs";

const lines = [
  "> Mission received…",
  "> Analyzing business goal…",
  "> Assembling AI workforce…",
  "> Deploying 5 specialized agents…",
];

export function MissionBriefing({
  mission,
  onDone,
  onStop,
}: {
  mission: string;
  onDone: () => void;
  onStop?: () => void;
}) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach((_, i) => timers.push(setTimeout(() => setVisible(i + 1), 350 + i * 400)));
    timers.push(setTimeout(onDone, 350 + lines.length * 400 + 400));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(250,251,255,0.7)", backdropFilter: "blur(8px)" }}>
      <BackgroundOrbs />
      <div className="glass-modal w-full max-w-xl p-10 animate-rise-in">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// MISSION BRIEFING</div>
        <h2 className="mt-2 font-display text-2xl font-bold">Deploying your AI team</h2>
        <div className="mt-1 text-sm text-muted-foreground truncate">Mission: "{mission}"</div>

        <div className="mt-6 space-y-2 font-mono text-sm">
          {lines.slice(0, visible).map((l) => (
            <div key={l} className="feed-in text-slate-700">{l}</div>
          ))}
          {visible < lines.length && (
            <div className="inline-block h-4 w-2 bg-primary pulse-dot" />
          )}
        </div>

        {onStop && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={onStop}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white/70 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Square className="h-3.5 w-3.5" fill="currentColor" />
              Stop deployment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
