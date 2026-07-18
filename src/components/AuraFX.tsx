import { useEffect, useRef, useState } from "react";
import { useAuraMode } from "@/lib/aura-mode";

/**
 * Renders the Aura Mode ambient overlay layers:
 *  - Animated aurora gradient
 *  - Floating particles
 *  - Cursor glow (blue) — replaces the default pink cursor glow
 *
 * All layers are pointer-events:none and only mount when Aura Mode is on.
 * The default light-mode <CursorGlow> keeps rendering underneath; we sit
 * above it and out-blend the pink halo with a stronger blue one.
 */
export function AuraFX() {
  const [enabled] = useAuraMode();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const l = () => setReduced(mq.matches);
    mq.addEventListener("change", l);
    return () => mq.removeEventListener("change", l);
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* Animated aurora — very subtle, ~5% */}
      <div aria-hidden className="aura-aurora pointer-events-none fixed inset-0 z-0" />
      {/* Floating particles */}
      {!reduced && <AuraParticles />}
      {/* Blue cursor glow (desktop only) */}
      <AuraCursorGlow />
    </>
  );
}

function AuraParticles() {
  // Pre-computed random positions so SSR + hydration match.
  const particles = Array.from({ length: 28 }).map((_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const r1 = seed / 233280;
    const r2 = ((seed * 3) % 233280) / 233280;
    const r3 = ((seed * 7) % 233280) / 233280;
    return {
      left: `${(r1 * 100).toFixed(2)}%`,
      top: `${(r2 * 100).toFixed(2)}%`,
      size: 2 + Math.floor(r3 * 4),
      delay: `-${(r1 * 20).toFixed(2)}s`,
      duration: `${18 + Math.floor(r2 * 22)}s`,
      hue: r3 > 0.66 ? "#00D4FF" : r3 > 0.33 ? "#A855F7" : "#7B8CFF",
    };
  });
  return (
    <div aria-hidden className="aura-particles pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map((p, i) => (
        <span
          key={i}
          className="aura-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: p.hue,
            boxShadow: `0 0 ${p.size * 4}px ${p.hue}`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

function AuraCursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);
  const pos = useRef({ x: -1000, y: -1000 });
  const [mount, setMount] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reduced) return;
    setMount(true);
    const onMove = (e: MouseEvent) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      if (raf.current != null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        const el = ref.current;
        if (!el) return;
        el.style.setProperty("--ax", `${pos.current.x}px`);
        el.style.setProperty("--ay", `${pos.current.y}px`);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, []);

  if (!mount) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(420px circle at var(--ax, -1000px) var(--ay, -1000px), rgba(108, 99, 255, 0.28), rgba(0, 212, 255, 0.10) 40%, transparent 70%)",
        mixBlendMode: "screen",
        transition: "background 60ms linear",
      }}
    />
  );
}
