import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Rocket, BookOpen, Zap, BarChart3, History,
  Settings, User, LogOut,
} from "lucide-react";

const nav = [
  { to: "/dashboard/command-center", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dashboard/command-center", label: "AI Employees", icon: Users, hash: "team" },
  { to: "/dashboard/start", label: "Start Business", icon: Rocket },
  { to: "/dashboard/command-center", label: "Knowledge", icon: BookOpen, disabled: true },
  { to: "/dashboard/command-center", label: "Automation", icon: Zap, hash: "automation" },
  { to: "/dashboard/command-center", label: "Reports", icon: BarChart3, disabled: true },
  { to: "/dashboard/command-center", label: "History", icon: History, disabled: true },
];

const footer = [
  { label: "Settings", icon: Settings },
  { label: "Profile", icon: User },
  { label: "Logout", icon: LogOut },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden md:flex md:w-[260px] shrink-0 flex-col p-4">
      <div className="glass-panel flex h-full flex-col p-5">
        <Link to="/dashboard/start" className="mb-8 flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white font-bold"
            style={{ background: "linear-gradient(135deg, #5B4FE9, #8B5CF6)" }}
          >
            A
          </div>
          <div className="font-display text-lg font-bold tracking-tight">Aura AI</div>
        </Link>

        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const active = pathname === item.to && !item.hash;
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={[
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-[rgba(91,79,233,0.1)] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                    : "text-slate-600 hover:bg-white/50",
                  item.disabled && "opacity-50 pointer-events-none",
                ].filter(Boolean).join(" ")}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <div className="my-3 h-px bg-slate-200/60" />
          {footer.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-white/50 transition"
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
