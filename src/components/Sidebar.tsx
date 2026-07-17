import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Rocket, BookOpen, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/start", label: "Start Business", icon: Rocket },
  { to: "/dashboard/knowledge", label: "Knowledge", icon: BookOpen },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted || !data.user) return;
      setEmail(data.user.email ?? null);
      const { data: p } = await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
      if (mounted) setUsername(p?.username ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <aside className="hidden md:flex md:w-[260px] shrink-0 flex-col p-4">
      <div className="glass-panel flex h-full flex-col p-5">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2.5">
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
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
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
                ].join(" ")}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <div className="my-3 h-px bg-slate-200/60" />
          <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-slate-600">
            <User className="h-4 w-4" />
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{username ?? "—"}</div>
              {email && <div className="truncate text-xs text-slate-400">{email}</div>}
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-white/50 transition"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
