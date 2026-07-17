import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEmployees } from "@/lib/employees.functions";

export const Route = createFileRoute("/_authenticated/dashboard/employees")({
  component: EmployeesLayout,
});

function EmployeesLayout() {
  // If a child route is matched, render just the outlet.
  const matches = useMatches();
  const isChild = matches.some((m) => m.routeId.includes("/dashboard/employees/"));
  if (isChild) return <Outlet />;
  return <EmployeesIndex />;
}

function EmployeesIndex() {
  const fn = useServerFn(listEmployees);
  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-employees"],
    queryFn: () => fn(),
  });

  return (
    <div className="space-y-6">
      <div className="animate-rise-in">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-mono">// AI EMPLOYEES</div>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Your AI team</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Each employee has a specialty and pulls context from your Knowledge base. Open one to
          give them a direct task or start a conversation.
        </p>
      </div>

      {isLoading && <div className="glass-panel p-6 text-sm text-slate-500">Loading team…</div>}
      {error && <div className="glass-panel p-4 text-sm text-red-600">{(error as Error).message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data?.map((emp) => (
          <Link
            key={emp.id}
            to="/dashboard/employees/$slug"
            params={{ slug: emp.slug }}
            className="glass-panel group relative overflow-hidden p-5 hover:-translate-y-0.5 transition-all"
            style={{ borderTop: `3px solid ${emp.accent}` }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lg"
                style={{ background: emp.accent }}
              >
                {emp.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-semibold">{emp.name}</div>
                <div className="text-xs uppercase tracking-wider text-slate-500">{emp.role_title}</div>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{emp.specialty_description}</p>
              </div>
            </div>
            <div className="mt-4 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition">
              Open →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
