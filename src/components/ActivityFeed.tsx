import { AGENT_MAP } from "@/lib/agents";

function formatTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

interface Event { id: string; agent: string; message: string; created_at: string; }

export function ActivityFeed({ events }: { events: Event[] }) {
  return (
    <div className="glass-panel flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">// Team Activity</div>
          <div className="font-display text-lg font-semibold">Live Feed</div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
          LIVE
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {events.length === 0 && (
          <div className="font-mono text-xs text-muted-foreground py-8 text-center">
            No activity yet.
          </div>
        )}
        {events.map((e) => {
          const meta = e.agent !== "system" ? AGENT_MAP[e.agent as keyof typeof AGENT_MAP] : null;
          return (
            <div key={e.id} className="feed-in flex gap-3 rounded-xl px-2 py-1.5 hover:bg-white/40">
              <span className="font-mono text-[11px] text-slate-400 shrink-0 tabular-nums pt-0.5">
                {formatTs(e.created_at)}
              </span>
              <div className="min-w-0">
                {meta ? (
                  <span
                    className="mr-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ color: meta.accent, background: `${meta.accent}15` }}
                  >
                    {meta.glyph} {meta.name.replace(" Agent", "")}
                  </span>
                ) : (
                  <span className="mr-1.5 inline-block rounded-md bg-slate-200/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    system
                  </span>
                )}
                <span className="text-sm text-slate-700">{e.message}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
