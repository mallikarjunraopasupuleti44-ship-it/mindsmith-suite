import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: AuthPage,
});

function safeRedirect(target?: string): string {
  if (!target) return "/dashboard";
  try {
    if (target.startsWith("/") && !target.startsWith("//")) return target;
    const u = new URL(target);
    if (typeof window !== "undefined" && u.origin === window.location.origin) return u.pathname + u.search;
  } catch { /* ignore */ }
  return "/dashboard";
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

function checkPasswordStrength(pw: string): { ok: boolean; message: string; score: number; label: string } {
  const checks = {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const label = score <= 2 ? "Weak" : score === 3 ? "Fair" : score === 4 ? "Good" : "Strong";
  const missing: string[] = [];
  if (!checks.length) missing.push("at least 8 characters");
  if (!checks.lower) missing.push("a lowercase letter");
  if (!checks.upper) missing.push("an uppercase letter");
  if (!checks.digit) missing.push("a number");
  if (!checks.symbol) missing.push("a symbol");
  const ok = missing.length === 0;
  return { ok, message: ok ? "" : `Password must include ${missing.join(", ")}.`, score, label };
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: safeRedirect(redirect) as any, replace: true });
    });
  }, [navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);

    if (mode === "signup") {
      if (!USERNAME_RE.test(username)) {
        setError("Username must be 3–24 letters, numbers, or underscores.");
        return;
      }
      const strength = checkPasswordStrength(password);
      if (!strength.ok) {
        setError(strength.message);
        return;
      }
      if (password !== confirm) {
        setError("Passwords don't match.");
        return;
      }
      // Pre-check uniqueness (auth.users trigger auto-suffixes, but we want to warn early)
      const { data: taken } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      if (taken) {
        setError("That username is already taken.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: safeRedirect(redirect) as any, replace: true });
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: `${window.location.origin}${safeRedirect(redirect)}`,
          },
        });
        if (error) throw error;
        // Auto-confirm is enabled — ensure a session by signing in if one wasn't returned.
        if (!signUpData.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) throw signInErr;
        }
        navigate({ to: safeRedirect(redirect) as any, replace: true });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) { setError((result.error as Error).message ?? "Google sign-in failed"); return; }
    if (result.redirected) return;
    navigate({ to: safeRedirect(redirect) as any, replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="glass-modal w-full max-w-md p-8 animate-rise-in">
        <Link to="/" className="flex items-center gap-2.5 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white font-bold" style={{ background: "linear-gradient(135deg, #5B4FE9, #8B5CF6)" }}>A</div>
          <div className="font-display text-lg font-bold tracking-tight">Aura AI</div>
        </Link>

        <h1 className="font-display text-2xl font-bold">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === "signin" ? "Sign in to your AI co-founder team." : "Deploy 5 AI agents on any business idea."}
        </p>

        <button
          onClick={google}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-input bg-white/60 px-4 py-2.5 text-sm font-medium hover:bg-white/90"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.6-2.2 3.4v2.8h3.5c2.1-1.9 3.3-4.7 3.3-8.2z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9C3.8 20.6 7.6 23 12 23z"/><path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V6.9H2C1.4 8.2 1 9.6 1 11.9s.4 3.7 1 5l3.7-2.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.1-3.1C17.5 2 15 1 12 1 7.6 1 3.8 3.4 2 6.9L5.7 9.8C6.6 7.2 9.1 5.4 12 5.4z"/></svg>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" /> OR <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="w-full rounded-xl border border-input bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@work.com"
            autoComplete="email"
            className="w-full rounded-xl border border-input bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="w-full rounded-xl border border-input bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          {mode === "signup" && (
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-input bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        {info && <div className="mt-3 text-sm text-primary">{info}</div>}

        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}
          className="mt-4 text-sm text-slate-500 hover:text-primary"
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
