import { useMissionStore } from "@/lib/mission-store";

export function StatsRow() {
  const stats = useMissionStore((s) => s.stats);
  const items = [
    { label: "Tasks Completed", value: stats.tasksCompleted },
    { label: "Words Produced",  value: stats.wordsProduced.toLocaleString() },
    { label: "Hours Saved",     value: stats.hoursSaved },
    { label: "Agents Active",   value: stats.agentsActive },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((it, i) => (
        <div key={it.label} className="glass p-5 animate-rise-in" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{it.label}</div>
          <div className="mt-2 font-mono text-3xl font-medium text-foreground">{it.value}</div>
        </div>
      ))}
    </div>
  );
}
