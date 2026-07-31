"use client";

import { useEffect } from "react";

// Registers the rest-timer notification worker (phase 3, §5.5). Deliberately
// scoped to zero fetch/cache handling — full app-shell precaching is phase 4
// and out of scope for this build; see public/sw.js.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort: vibration/sound complements still work without the SW.
    });
  }, []);

  return null;
}
