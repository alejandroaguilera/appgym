"use client";

import { useEffect, useRef } from "react";

// §4.4: keep the screen on for the whole session, with reactivation when
// returning from background — the OS releases the lock automatically when
// the tab is hidden, so it must be reacquired on visibilitychange.
export function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        lockRef.current = lock;
      } catch {
        // Not fatal — countdown display + audio still work while the tab
        // is foregrounded; this only helps keep it that way longer.
      }
    };

    void acquire();

    const onVisible = () => {
      if (document.visibilityState === "visible" && !lockRef.current) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lockRef.current?.release();
      lockRef.current = null;
    };
  }, [active]);
}
