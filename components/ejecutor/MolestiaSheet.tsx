"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";

const ZONAS_COMUNES = ["Hombro", "Codo", "Muñeca", "Espalda baja", "Rodilla", "Cadera"];

interface MolestiaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (zona: string, nivel: number, nota: string) => void;
}

// Reportar molestia: un toque desde el ejecutor (spec §4.4) — a safety
// requirement given the athlete's shoulder-tendinitis history, not a
// secondary feature.
export function MolestiaSheet({ open, onOpenChange, onSubmit }: MolestiaSheetProps) {
  const [zona, setZona] = useState("");
  const [nivel, setNivel] = useState(5);
  const [nota, setNota] = useState("");

  function handleSubmit() {
    if (!zona.trim()) return;
    onSubmit(zona.trim(), nivel, nota.trim());
    setZona("");
    setNivel(5);
    setNota("");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Reportar molestia">
      <div className="flex flex-col gap-4">
        <div>
          <span className="text-xs uppercase tracking-wide text-muted">Zona</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ZONAS_COMUNES.map((z) => (
              <Chip key={z} selected={zona === z} onClick={() => setZona(z)}>
                {z}
              </Chip>
            ))}
          </div>
          <Input
            className="mt-2"
            placeholder="Otra zona..."
            value={ZONAS_COMUNES.includes(zona) ? "" : zona}
            onChange={(e) => setZona(e.target.value)}
          />
        </div>

        <div>
          <span className="text-xs uppercase tracking-wide text-muted">Nivel (1-10)</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Chip key={n} selected={nivel === n} onClick={() => setNivel(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs uppercase tracking-wide text-muted">Nota (opcional)</span>
          <textarea
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-raised p-3 text-base"
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>

        <Button size="lg" variant="destructive" onClick={handleSubmit} disabled={!zona.trim()}>
          Reportar
        </Button>
      </div>
    </Sheet>
  );
}
