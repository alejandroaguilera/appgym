"use client";

import { useEffect, useState } from "react";

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onExpire: () => void;
  durationMs?: number;
}

// Confirmations resolve with "deshacer", not "¿estás seguro?" (spec §8) —
// visible for 10s per §4.4.
export function UndoToast({ message, onUndo, onExpire, durationMs = 10_000 }: UndoToastProps) {
  const [remainingMs, setRemainingMs] = useState(durationMs);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      const left = durationMs - (Date.now() - startedAt);
      if (left <= 0) {
        clearInterval(id);
        onExpire();
      } else {
        setRemainingMs(left);
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-surface-raised px-4 py-2.5 shadow-lg">
      <span className="text-sm">{message}</span>
      <button
        onClick={onUndo}
        className="h-9 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground"
      >
        Deshacer ({Math.ceil(remainingMs / 1000)}s)
      </button>
    </div>
  );
}
