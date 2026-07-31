"use client";

import { useEffect, useState } from "react";

// §5.5: never accumulate with setInterval. The interval here only forces a
// re-render; the value itself is always (now - startedAt), so a
// frozen/backgrounded tab self-corrects the instant it resumes rather than
// drifting behind. Also recomputes immediately on visibilitychange rather
// than waiting for the next tick.
export function useElapsedSeconds(startedAtMs: number | null, offsetMs = 0, tickMs = 500): number {
  const [, force] = useState(0);

  useEffect(() => {
    if (startedAtMs === null) return;
    const id = setInterval(() => force((n) => n + 1), tickMs);
    const onVisible = () => force((n) => n + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [startedAtMs, tickMs]);

  if (startedAtMs === null) return 0;
  return Math.max(0, Math.floor((Date.now() - startedAtMs - offsetMs) / 1000));
}

export function formatMMSS(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(totalSeconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}
