"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatMMSS } from "@/lib/hooks/useElapsed";

interface ExecutorHeaderProps {
  nombreSesion: string;
  iniciadaEnMs: number;
  pausedMs: number; // sum of completed pauses
  pauseStartedAtMs: number | null; // set while currently paused
  seriesCompletadas: number;
  seriesPlaneadas: number;
  onTogglePause: () => void;
}

export function ExecutorHeader({
  nombreSesion,
  iniciadaEnMs,
  pausedMs,
  pauseStartedAtMs,
  seriesCompletadas,
  seriesPlaneadas,
  onTogglePause,
}: ExecutorHeaderProps) {
  const [, force] = useState(0);
  const paused = pauseStartedAtMs !== null;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [paused]);

  // Absolute-timestamp arithmetic, never a `setInterval` accumulator
  // (§5.5) — frozen at the instant of pause, self-correcting on resume.
  const nowMs = paused ? pauseStartedAtMs! : Date.now();
  const elapsedSec = Math.max(0, Math.floor((nowMs - iniciadaEnMs - pausedMs) / 1000));

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{nombreSesion}</div>
          <div className="text-xs text-muted">
            {seriesCompletadas}/{seriesPlaneadas} series
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tabular-nums">{formatMMSS(elapsedSec)}</span>
          <button
            onClick={onTogglePause}
            aria-label={paused ? "Reanudar" : "Pausar"}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-raised"
          >
            {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
