import { X, Paperclip } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { AGENT_MAP } from "@/lib/agents";
import type { AgentId } from "@/lib/agent-schemas";
import { StatusPill } from "./StatusPill";
import { approveDeliverable, requestRevision } from "@/lib/agents.functions";

interface Task {
  id: string;
  project_id: string;
  status: string;
  deliverable: any;
  deliverable_title: string | null;
  error: string | null;
}

export function ReviewModal({
  agentId,
  task,
  sources,
  onClose,
}: {
  agentId: AgentId;
  task: Task;
  sources: { file_name: string; document_id: string }[];
  onClose: () => void;
}) {
  const meta = AGENT_MAP[agentId];
  const qc = useQueryClient();
  const approveFn = useServerFn(approveDeliverable);
  const reviseFn = useServerFn(requestRevision);

  const approve = useMutation({
    mutationFn: () => approveFn({ data: { taskId: task.id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", task.project_id] }); onClose(); },
  });
  const revise = useMutation({
    mutationFn: () => reviseFn({ data: { taskId: task.id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", task.project_id] }); onClose(); },
  });

  const d = task.deliverable;
  const title = task.deliverable_title ?? "Deliverable";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div className="glass-modal my-8 w-full max-w-4xl p-8 animate-rise-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-semibold"
              style={{ color: meta.accent, background: `${meta.accent}18`, boxShadow: `0 0 0 1px ${meta.accent}30` }}
            >
              {meta.glyph}
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold">{title}</h2>
              <div className="text-sm text-muted-foreground">
                Produced by {meta.name} ({meta.role})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={task.status} />
            <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/70"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {sources.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
            <Paperclip className="h-3.5 w-3.5" />
            Referenced {sources.length} document{sources.length === 1 ? "" : "s"}:
            {sources.map((s) => (
              <span key={s.document_id} className="rounded-md bg-white/60 px-2 py-0.5">{s.file_name}</span>
            ))}
          </div>
        )}

        <div className="mt-6 max-h-[62vh] overflow-y-auto pr-2">
          {task.error && !d && (
            <div className="glass p-6 text-sm text-red-600">
              This agent hit an error: {task.error}
            </div>
          )}
          {d && <DeliverableBody agentId={agentId} data={d} accent={meta.accent} />}
        </div>

        {task.status !== "approved" && d && (
          <div className="mt-6 flex justify-end gap-2 border-t border-slate-200/60 pt-5">
            <button
              onClick={() => revise.mutate()}
              disabled={revise.isPending}
              className="rounded-2xl px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-white/70 disabled:opacity-50"
            >
              {revise.isPending ? "Reworking…" : "Request revision"}
            </button>
            <button
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
              className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md hover:opacity-90 hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {approve.isPending ? "Approving…" : "Approve work"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">// {title}</div>
      <div className="text-sm text-slate-700 leading-relaxed">{children}</div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="glass p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-1 font-mono text-2xl font-medium" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function DeliverableBody({ agentId, data, accent }: { agentId: AgentId; data: any; accent: string }) {
  if (!data) return null;
  if (agentId === "planner") {
    return (
      <div>
        <Section title="Business Concept">{data.concept}</Section>
        <Section title="Brand Identity">
          <div className="flex items-center gap-3">
            <span className="font-medium">{data.brand?.name}</span>
            <span className="text-muted-foreground">·</span>
            <span>{data.brand?.voice}</span>
          </div>
          <div className="mt-2 flex gap-2">
            {(data.brand?.palette ?? []).map((c: string) => (
              <div key={c} className="h-8 w-8 rounded-lg border border-white/80 shadow-sm" style={{ background: c }} />
            ))}
          </div>
        </Section>
        <Section title="Target Market">{data.market}</Section>
        <Section title="Competitive Edge">
          <ul className="list-disc pl-5 space-y-1">{(data.edge ?? []).map((e: string) => <li key={e}>{e}</li>)}</ul>
        </Section>
        <Section title="Revenue Streams">
          <div className="flex flex-wrap gap-2">
            {(data.revenue ?? []).map((r: string) => (
              <span key={r} className="glass-pill px-3 py-1 text-xs">{r}</span>
            ))}
          </div>
        </Section>
        <Section title="Launch Roadmap">
          <div className="overflow-hidden rounded-2xl border border-slate-200/70">
            <table className="w-full text-sm">
              <thead className="bg-white/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">Phase</th><th className="p-3">Weeks</th><th className="p-3">Actions</th></tr>
              </thead>
              <tbody>
                {(data.roadmap ?? []).map((r: any) => (
                  <tr key={r.phase} className="border-t border-slate-200/60">
                    <td className="p-3 font-medium">{r.phase}</td>
                    <td className="p-3 font-mono text-xs">{r.weeks}</td>
                    <td className="p-3">{r.actions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="Key Success Metrics">
          <div className="grid grid-cols-2 gap-2">
            {(data.metrics ?? []).map((m: string) => (
              <div key={m} className="rounded-xl bg-white/50 border border-slate-200/60 px-3 py-2 font-mono text-xs">{m}</div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  if (agentId === "marketing") {
    return (
      <div>
        <Section title="Brand Voice">{data.voice}</Section>
        <Section title="Campaign Strategy">{data.strategy}</Section>
        <Section title="Post Calendar">
          <div className="grid gap-3 md:grid-cols-2">
            {(data.posts ?? []).map((p: any, i: number) => (
              <div key={i} className="glass p-4">
                <div className="font-mono text-[10px] text-primary">{p.time}</div>
                <div className="mt-1 font-display font-semibold">{p.headline}</div>
                <div className="mt-1 text-sm text-slate-600">{p.body}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(p.tags ?? []).map((t: string) => (
                    <span key={t} className="rounded-md bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-600">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  if (agentId === "finance") {
    const stats = data.stats ?? { investment: 0, monthlyBurn: 0, breakevenMonth: 0 };
    return (
      <div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Investment" value={`$${Math.round(stats.investment / 1000)}k`} accent={accent} />
          <StatCard label="Monthly Burn" value={`$${(stats.monthlyBurn / 1000).toFixed(1)}k`} accent="#F59E0B" />
          <StatCard label="Break-even" value={`Month ${stats.breakevenMonth}`} accent="#5B4FE9" />
        </div>
        <Section title="Revenue vs Expenses (12mo)">
          <div className="glass p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthly ?? []}>
                <CartesianGrid stroke="rgba(15,23,42,0.06)" vertical={false} />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12 }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="expenses" stroke="#5B4FE9" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Startup Cost Breakdown">
          <div className="glass p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.costs ?? []}>
                <CartesianGrid stroke="rgba(15,23,42,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12 }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="value" fill="#F59E0B" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>
    );
  }

  if (agentId === "operations") {
    return (
      <div>
        <Section title="Supplier Checklist">
          <ul className="space-y-1.5">
            {(data.suppliers ?? []).map((s: string) => (
              <li key={s} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Daily SOP">
          <ol className="space-y-2">
            {(data.sop ?? []).map((s: string, i: number) => (
              <li key={i} className="flex gap-3 rounded-xl bg-white/50 border border-slate-200/60 px-3 py-2 font-mono text-xs">
                <span className="text-primary font-semibold">{String(i + 1).padStart(2, "0")}</span>
                {s}
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Quality Control">
          <ul className="space-y-1.5">
            {(data.quality ?? []).map((s: string) => (
              <li key={s} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    );
  }

  if (agentId === "website") {
    const brand = data.brand ?? "Your Business";
    return (
      <div>
        <Section title="Live Preview">
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-md">
            <div className="flex items-center gap-1.5 border-b border-slate-200/60 bg-slate-100/70 px-3 py-2">
              <div className="h-3 w-3 rounded-full bg-red-400/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
              <div className="h-3 w-3 rounded-full bg-green-400/70" />
              <div className="ml-3 font-mono text-[10px] text-slate-500">{String(brand).toLowerCase().replace(/\s+/g, "")}.com</div>
            </div>
            <div className="bg-white p-8 text-center">
              <div className="text-[10px] uppercase tracking-widest text-primary font-mono">// {brand}</div>
              <h3 className="mt-3 font-display text-3xl font-bold">{data.tagline}</h3>
              <p className="mt-3 text-sm text-slate-600 max-w-md mx-auto">Made with care in your neighborhood. Come see what we've been building.</p>
              <button className="mt-5 rounded-2xl bg-sky-500 px-5 py-2.5 text-sm font-medium text-white shadow-md">Visit us</button>
              <div className="mt-8 grid grid-cols-5 gap-2">
                {(data.sections ?? []).map((s: string) => (
                  <div key={s} className="rounded-lg bg-slate-100 py-2 text-[10px] font-mono text-slate-500">{s}</div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>
    );
  }

  return null;
}
