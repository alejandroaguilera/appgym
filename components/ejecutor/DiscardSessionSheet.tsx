"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface DiscardSessionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesRegistradas: number;
  onDescartar: () => Promise<void>;
}

// Salida de emergencia del ejecutor: matar la sesión sin guardarla, para
// volver a Hoy con la plantilla otra vez pendiente. Es destructivo e
// irreversible, así que pasa por un sheet — el patrón sancionado por el spec
// §8 frente a un `confirm()` bloqueante (ver el header de ui/sheet.tsx).
export function DiscardSessionSheet({
  open,
  onOpenChange,
  seriesRegistradas,
  onDescartar,
}: DiscardSessionSheetProps) {
  const [descartando, setDescartando] = useState(false);

  async function handleDescartar() {
    setDescartando(true);
    try {
      await onDescartar();
    } finally {
      setDescartando(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={descartando ? () => {} : onOpenChange} title="¿Descartar entrenamiento?">
      <p className="mb-5 text-sm text-muted">
        {seriesRegistradas > 0
          ? `Se borrarán las ${seriesRegistradas} series que llevas registradas y esta sesión volverá a quedar pendiente.`
          : "Esta sesión se cerrará sin guardar nada y volverá a quedar pendiente."}{" "}
        No se puede deshacer.
      </p>

      <div className="flex flex-col gap-2">
        <Button variant="destructive" size="lg" onClick={handleDescartar} disabled={descartando}>
          {descartando ? "Descartando…" : "Sí, descartar"}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => onOpenChange(false)} disabled={descartando}>
          Seguir entrenando
        </Button>
      </div>
    </Sheet>
  );
}
