import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Rocket, BookOpen, LogOut, Users, Zap,
  BarChart3, History, Settings, UserCircle2, Menu, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { AtomLogo } from "./AtomLogo";

type Item = {
  to?: string;
  label: string;
  icon: any;
  exact?: boolean;
  disabled?: boolean;
};

const mainNav: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/employees", label: "AI Employees", icon: Users },
  { to: "/dashboard/start", label: "Start Business", icon: Rocket },
  { to: "/dashboard/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/dashboard/automation", label: "Automation", icon: Zap },
  { to: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { to: "/dashboard/history", label: "History", icon: History },
];

const footerNav: Item[] = [
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
  { to: "/dashboard/profile", label: "Profile", icon: UserCircle2 },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted || !data.user) return;
      const { data: p } = await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
      if (mounted) setUsername(p?.username ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const renderItem = (item: Item) => {
    const active = item.to && (item.exact ? pathname === item.to : pathname.startsWith(item.to));
    const Icon = item.icon;
    const base = "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition";
    const cls = active
      ? "bg-[rgba(91,79,233,0.1)] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
      : item.disabled
      ? "text-slate-400 cursor-not-allowed"
      : "text-slate-600 hover:bg-white/50";

    if (item.disabled || !item.to) {
      return (
        <button key={item.label} type="button" disabled className={`${base} ${cls} w-full text-left`}>
          <Icon className="h-4 w-4" strokeWidth={2} />
          {item.label}
        </button>
      );
    }
    return (
      <Link key={item.label} to={item.to} className={`${base} ${cls}`}>
        <Icon className="h-4 w-4" strokeWidth={2} />
        {item.label}
      </Link>
    );
  };

  const panel = (
    <div className="glass-panel flex h-full flex-col p-5">
      <Link to="/dashboard" className="mb-6 flex items-center gap-2.5">
        <AtomLogo size={38} />
        <div className="font-display text-lg font-bold tracking-tight">
          Aura <span className="text-primary">AI</span>
        </div>
      </Link>

      <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Main Menu
      </div>
      <nav className="flex flex-col gap-1">{mainNav.map(renderItem)}</nav>

      <div className="mt-auto pt-6">
        <div className="my-3 h-px bg-slate-200/60" />
        <nav className="flex flex-col gap-1">{footerNav.map(renderItem)}</nav>
        {username && (
          <div className="mt-2 truncate px-3 py-1 text-xs text-slate-400">
            @{username}
          </div>
        )}
        <button
          onClick={signOut}
          className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-50/70 transition"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/40 bg-white/70 px-4 py-3 backdrop-blur-xl">
        <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
          <AtomLogo size={32} />
          <div className="font-display text-base font-bold tracking-tight truncate">
            Aura <span className="text-primary">AI</span>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="glass-pill inline-flex h-10 w-10 shrink-0 items-center justify-center text-slate-700"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[260px] shrink-0 flex-col p-4">
        {panel}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex w-[280px] max-w-[85vw] flex-col p-3 animate-in slide-in-from-left">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-5 top-6 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-600 shadow"
            >
              <X className="h-4 w-4" />
            </button>
            {panel}
          </div>
        </div>
      )}
    </>
  );
}
