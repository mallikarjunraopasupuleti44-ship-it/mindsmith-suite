import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "aura-mode-enabled";
const EVENT = "aura-mode-change";

function readSaved(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

function applyClass(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("aura-mode", on);
}

/**
 * Global Aura Mode state. Persists to localStorage, syncs across all
 * components in the tab via a custom event, and applies the `aura-mode`
 * class to <html>. Safe to call from any component.
 */
export function useAuraMode(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    const initial = readSaved();
    setEnabled(initial);
    applyClass(initial);
    const onChange = (e: Event) => setEnabled((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENT, onChange as EventListener);
    return () => window.removeEventListener(EVENT, onChange as EventListener);
  }, []);

  const set = useCallback((next: boolean) => {
    try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
    applyClass(next);
    window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: next }));
  }, []);

  return [enabled, set];
}
