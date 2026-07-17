import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Rocket, CheckCircle2, FileText, Zap, Users, Flame, Calendar, BookOpen } from "lucide-react";
import { getReport } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/dashboard/reports")({
  component: ReportsPage,
});

const COLORS = ["#5B4FE9", "#22C55E", "#F59E0B", "#EF4444", "#0EA5E9", "#A855F7"];

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-mono">{label}</div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function ReportsPage() {
  const fn = useServerFn(getReport);
  const q = useQuery({ queryKey: ["report"], queryFn: () => fn(), refetchInterval: 30_000 });

  if (q.isLoading) return <div className="glass-panel p-10 text-center text-slate-500">Loading your growth report…</div>;
  if (q.isError) return <div className="glass-panel p-10 text-center text-red-500">{(q.error as Error).message}</div>;
  const r = q.data!;

  const platformData = Object.entries(r.postsByPlatform).map(([name, value]) => ({ name, value }));
  const docCategoryData = Object.entries(r.docsByCategory).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// Reports</div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Your growth on Aura AI</h1>
        <p className="mt-2 text-sm text-slate-500">
          A live snapshot of what you've built here — missions, deliverables, posts, and knowledge — auto-refreshing every 30 seconds.
        </p>
      </div>

      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Stat icon={Rocket} label="Missions" value={r.totals.missions} hint={`${r.totals.missionsCompleted} completed`} />
        <Stat icon={CheckCircle2} label="Deliverables approved" value={r.totals.deliverablesApproved} hint={`of ${r.totals.deliverablesTotal} produced`} />
        <Stat icon={Zap} label="Posts created" value={r.totals.posts} hint={`${r.postsByStatus.published} published`} />
        <Stat icon={BookOpen} label="Knowledge docs" value={r.totals.knowledgeDocs} hint={`${r.docsByStatus.indexed} indexed`} />
        <Stat icon={Users} label="AI employees" value={r.totals.employees} />
        <Stat icon={FileText} label="Activity events" value={r.totals.activityEvents} />
        <Stat icon={Flame} label="Active-day streak" value={r.streak} hint="consecutive days" />
        <Stat icon={Calendar} label="Days on Aura" value={r.daysActive ?? "—"} hint={r.joinedAt ? `joined ${new Date(r.joinedAt).toLocaleDateString()}` : ""} />
      </section>

      <section className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold">Activity — last 30 days</h2>
          <div className="text-xs text-slate-500">Missions · Deliverables · Posts · Docs</div>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={r.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={10} stroke="#94a3b8" />
              <YAxis allowDecimals={false} fontSize={10} stroke="#94a3b8" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="missions" stackId="a" fill="#5B4FE9" radius={[0, 0, 0, 0]} />
              <Bar dataKey="deliverables" stackId="a" fill="#22C55E" />
              <Bar dataKey="posts" stackId="a" fill="#F59E0B" />
              <Bar dataKey="docs" stackId="a" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass-panel p-5">
          <h2 className="font-display font-bold mb-4">Posts by platform</h2>
          {r.totals.posts === 0 ? (
            <p className="text-sm text-slate-500">No posts yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={platformData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {platformData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex justify-around text-xs text-slate-600">
            <span>Draft: <b>{r.postsByStatus.draft}</b></span>
            <span>Scheduled: <b>{r.postsByStatus.scheduled}</b></span>
            <span>Published: <b>{r.postsByStatus.published}</b></span>
          </div>
        </section>

        <section className="glass-panel p-5">
          <h2 className="font-display font-bold mb-4">Knowledge by category</h2>
          {r.totals.knowledgeDocs === 0 ? (
            <p className="text-sm text-slate-500">No documents uploaded yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={docCategoryData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {docCategoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex justify-around text-xs text-slate-600">
            <span>Indexed: <b>{r.docsByStatus.indexed}</b></span>
            <span>Processing: <b>{r.docsByStatus.processing}</b></span>
            <span>Failed: <b>{r.docsByStatus.failed}</b></span>
          </div>
        </section>
      </div>

      <section className="glass-panel p-5">
        <h2 className="font-display font-bold mb-4">Recent activity</h2>
        {r.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet. Start a mission to see events here.</p>
        ) : (
          <ul className="divide-y divide-slate-200/60">
            {r.recentActivity.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-slate-700 truncate">{a.message}</div>
                  <div className="text-xs text-slate-400">{a.agent}</div>
                </div>
                <div className="text-xs text-slate-400 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
