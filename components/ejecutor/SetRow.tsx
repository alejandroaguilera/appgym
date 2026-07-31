"use client";

import { Check, Flame } from "lucide-react";
import { Stepper } from "@/components/ui/stepper";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TipoSet } from "@/lib/db/types";

interface ConfirmedSetRowProps {
  numeroSerie: number;
  pesoKg: number;
  reps: number;
  rir: number | null;
  tipo: TipoSet;
  esPr: boolean;
}

export function ConfirmedSetRow({ numeroSerie, pesoKg, reps, rir, tipo, esPr }: ConfirmedSetRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-raised px-3 py-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
        {numeroSerie}
      </span>
      <span className="flex-1 text-lg font-semibold tabular-nums">
        {pesoKg}kg × {reps}
        {rir != null && <span className="ml-2 text-sm font-normal text-muted">RIR {rir}</span>}
      </span>
      {tipo === "CALENTAMIENTO" && <span className="text-xs text-muted">calentamiento</span>}
      {esPr && <span title="PR" className="text-warning">★</span>}
    </div>
  );
}

interface SetInputRowProps {
  pesoKg: number;
  reps: number;
  rir: number | null;
  tipo: TipoSet;
  incrementoMinimoKg: number;
  onPesoChange: (v: number) => void;
  onRepsChange: (v: number) => void;
  onRirChange: (v: number) => void;
  onTipoChange: (v: TipoSet) => void;
  onConfirm: () => void;
}

export function SetInputRow({
  pesoKg,
  reps,
  rir,
  tipo,
  incrementoMinimoKg,
  onPesoChange,
  onRepsChange,
  onRirChange,
  onTipoChange,
  onConfirm,
}: SetInputRowProps) {
  const isWarmup = tipo === "CALENTAMIENTO";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <Stepper label="kg" value={pesoKg} step={incrementoMinimoKg} onChange={onPesoChange} />
        <Stepper label="reps" value={reps} step={1} onChange={onRepsChange} />
      </div>

      <div className="mt-4">
        <span className="text-xs uppercase tracking-wide text-muted">RIR</span>
        <div className="mt-1 flex gap-2">
          {[0, 1, 2, 3, 4].map((n) => (
            <Chip key={n} selected={rir === n} onClick={() => onRirChange(n)}>
              {n}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onTipoChange(isWarmup ? "TRABAJO" : "CALENTAMIENTO")}
          className={cn(
            "flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
            isWarmup
              ? "border-warning bg-warning/15 text-warning"
              : "border-border bg-surface-raised text-muted"
          )}
        >
          <Flame className="size-4" />
          Calentamiento
        </button>
        <Button size="xl" className="flex-1 !h-14 !text-xl" onClick={onConfirm}>
          <Check className="size-6" />
          Confirmar
        </Button>
      </div>
    </div>
  );
}
