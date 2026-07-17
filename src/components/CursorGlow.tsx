import { useEffect, useRef, useState } from "react";

/**
 * Rose-pink glow that follows the pointer.
 * - Mounted once globally above ambient orbs, below content.
 * - Throttled with rAF; disabled on touch-only devices.
 * - Respects prefers-reduced-motion.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const target = useRef({ x: -1000, y: -1000 });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reduced) return;
    setEnabled(true);

    const onMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = ref.current;
        if (!el) return;
        el.style.setProperty("--mx", `${target.current.x}px`);
        el.style.setProperty("--my", `${target.current.y}px`);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(500px circle at var(--mx, -1000px) var(--my, -1000px), rgba(244,114,182,0.18), transparent 70%)",
        transition: "background 60ms linear",
      }}
    />
  );
}
