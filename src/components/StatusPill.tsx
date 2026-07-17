import type { AgentStatus } from "@/lib/mission-store";

const config: Record<AgentStatus, { label: string; dot: string; text: string; bg: string }> = {
  idle:         { label: "Idle",         dot: "#94A3B8", text: "#64748B", bg: "rgba(148,163,184,0.12)" },
  working:      { label: "Working",      dot: "#5B4FE9", text: "#5B4FE9", bg: "rgba(91,79,233,0.12)" },
  needs_review: { label: "Needs Review", dot: "#F59E0B", text: "#B45309", bg: "rgba(245,158,11,0.14)" },
  approved:     { label: "Approved",     dot: "#10B981", text: "#047857", bg: "rgba(16,185,129,0.14)" },
};

export function StatusPill({ status }: { status: AgentStatus }) {
  const c = config[status];
  const pulse = status === "working";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-500"
      style={{ background: c.bg, color: c.text }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${pulse ? "pulse-dot" : ""}`}
        style={{ background: c.dot }}
      />
      {c.label}
    </span>
  );
}
