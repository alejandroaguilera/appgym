"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useElapsedSeconds, formatMMSS } from "@/lib/hooks/useElapsed";
import { updateRestTimer, clearRestTimer } from "@/lib/db/restTimer";
import { scheduleRestEndNotification, cancelRestEndNotification, vibrate } from "@/lib/notify";
import { playRestEndSound } from "@/lib/audio";
import type { RestTimerRecord } from "@/lib/db/types";

interface RestTimerProps {
  sessionLogId: string;
  timer: RestTimerRecord;
  onChange: (timer: RestTimerRecord | null) => void;
}

export function RestTimer({ sessionLogId, timer, onChange }: RestTimerProps) {
  const elapsedSec = useElapsedSeconds(timer.status === "running" ? timer.startedAt : null);
  const remaining = timer.durationSec - elapsedSec;
  const firedRef = useRef(false);

  // (Re-)arm the SW-scheduled notification whenever the timer's target
  // changes, plus a heartbeat while running to reduce (not eliminate) the
  // idle-kill window on a suspended service worker — see public/sw.js.
  useEffect(() => {
    if (timer.status !== "running") return;
    const endsAt = timer.startedAt + timer.durationSec * 1000;
    scheduleRestEndNotification(endsAt);
    const heartbeat = setInterval(() => scheduleRestEndNotification(endsAt), 10_000);
    return () => clearInterval(heartbeat);
  }, [timer.status, timer.startedAt, timer.durationSec]);

  useEffect(() => {
    firedRef.current = false;
  }, [timer.startedAt, timer.durationSec]);

  useEffect(() => {
    if (timer.status === "running" && remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      vibrate([300, 100, 300]);
      playRestEndSound();
    }
  }, [remaining, timer.status]);

  async function adjust(deltaSec: number) {
    const updated = await updateRestTimer(sessionLogId, {
      durationSec: Math.max(0, timer.durationSec + deltaSec),
    });
    if (updated) onChange(updated);
  }

  async function reiniciar() {
    const updated = await updateRestTimer(sessionLogId, { startedAt: Date.now() });
    if (updated) onChange(updated);
  }

  async function saltar() {
    cancelRestEndNotification();
    await clearRestTimer(sessionLogId);
    onChange(null);
  }

  const overtime = remaining < 0;

  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted">Descanso</span>
        <button onClick={saltar} className="h-11 px-3 text-sm text-muted hover:text-foreground">
          Saltar
        </button>
      </div>
      <div
        className={`text-center text-6xl font-black tabular-nums ${overtime ? "text-warning" : "text-foreground"}`}
      >
        {formatMMSS(remaining)}
      </div>
      <div className="mt-3 flex justify-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => adjust(-15)}>
          −15s
        </Button>
        <Button variant="secondary" size="sm" onClick={reiniciar}>
          Reiniciar
        </Button>
        <Button variant="secondary" size="sm" onClick={() => adjust(15)}>
          +15s
        </Button>
      </div>
    </div>
  );
}
