import { useEffect, useRef, useState } from "react";
import { Sparkles, Moon } from "lucide-react";

const STORAGE_KEY = "aura-mode-enabled";

/**
 * Aura Mode — global visual + ambient audio toggle.
 * - Adds/removes `aura-mode` class on <html>, driving global CSS.
 * - Plays a soft synthesized ambient pad using Web Audio (no asset).
 * - Persists preference. Respects reduced-motion for animation only.
 */
export function AuraModeToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const audioRef = useRef<{
    ctx: AudioContext;
    master: GainNode;
    stop: () => void;
  } | null>(null);

  // Load persisted preference.
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setEnabled(true);
    } catch {}
  }, []);

  // Apply class to <html> whenever enabled changes.
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (enabled) root.classList.add("aura-mode");
    else root.classList.remove("aura-mode");
    try { localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0"); } catch {}
  }, [enabled, mounted]);

  // Manage ambient audio.
  useEffect(() => {
    if (!enabled) {
      audioRef.current?.stop();
      audioRef.current = null;
      return;
    }
    // User clicked to enable → we have a gesture, safe to create context.
    try {
      const AC: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      // Low-pass filter for warmth.
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      filter.Q.value = 0.7;
      filter.connect(master);

      // A slow feedback delay adds shimmer without needing a reverb impulse.
      const delay = ctx.createDelay(2);
      delay.delayTime.value = 0.55;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.35;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(master);

      // Three detuned sine oscillators — soft chord (A2, E3, C#4).
      const freqs = [110, 164.81, 277.18];
      const oscs = freqs.map((f, i) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0;
        o.connect(g);
        g.connect(filter);
        g.connect(delay);
        // LFO for slow amplitude swell per voice.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.06 + i * 0.03;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.08;
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);
        g.gain.setValueAtTime(0.09, ctx.currentTime);
        o.start();
        lfo.start();
        return { o, lfo };
      });

      // Fade in.
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2.2);

      audioRef.current = {
        ctx,
        master,
        stop: () => {
          try {
            const now = ctx.currentTime;
            master.gain.cancelScheduledValues(now);
            master.gain.setValueAtTime(master.gain.value, now);
            master.gain.linearRampToValueAtTime(0, now + 0.6);
            setTimeout(() => {
              oscs.forEach(({ o, lfo }) => { try { o.stop(); lfo.stop(); } catch {} });
              try { ctx.close(); } catch {}
            }, 700);
          } catch {}
        },
      };
    } catch (e) {
      console.warn("Aura Mode audio unavailable", e);
    }

    return () => {
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, [enabled]);

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={() => setEnabled((v) => !v)}
      aria-pressed={enabled}
      aria-label={enabled ? "Turn off Aura Mode" : "Turn on Aura Mode"}
      title={enabled ? "Aura Mode: On" : "Aura Mode: Off"}
      className="aura-mode-toggle fixed bottom-6 left-6 z-[60] inline-flex h-12 w-12 items-center justify-center rounded-full text-white transition"
      data-active={enabled ? "true" : "false"}
    >
      {enabled ? <Sparkles className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
