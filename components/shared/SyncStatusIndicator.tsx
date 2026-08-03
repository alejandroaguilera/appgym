"use client";

import { useEffect, useState } from "react";
import { CloudUpload } from "lucide-react";
import { getPendingCount, subscribeSyncStatus } from "@/lib/sync/client";
import { cn } from "@/lib/utils";

// Discrete, never alarmist (spec §5.3): being unsynced is a normal state,
// not an error. No red, no spinner blocking anything.
export function SyncStatusIndicator() {
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      getPendingCount().then((n) => {
        if (mounted) setPending(n);
      });
    };
    refresh();
    const unsubscribe = subscribeSyncStatus(refresh);
    const interval = setInterval(refresh, 5000);
    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // No persistente: solo aparece mientras hay algo sin confirmar en el
  // servidor. En cuanto sincroniza, desaparece — no queda un "sincronizado ✓"
  // fijo estorbando indefinidamente.
  if (pending === null || pending === 0) return null;

  return (
    <div
      className={cn(
        // Levantado lo suficiente para librar tanto la barra de tabs
        // inferior como las barras de acción fijas de pantallas anidadas
        // (bloques/[id], hoy/[sessionTemplateId]) — ni las esquinas
        // superiores están libres en todas las pantallas (chocan con el
        // botón de pausa del ejecutor o los links "← volver").
        "fixed bottom-28 right-3 z-30 flex items-center gap-1.5 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs text-muted backdrop-blur"
      )}
    >
      <CloudUpload className="size-3.5" />
      <span>{pending} cambio{pending === 1 ? "" : "s"} pendiente{pending === 1 ? "" : "s"}</span>
    </div>
  );
}
