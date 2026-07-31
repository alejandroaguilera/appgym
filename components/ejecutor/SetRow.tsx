"use client";

import { useState } from "react";
import { Check, Flame, Pencil, Trash2, X } from "lucide-react";
import { Stepper } from "@/components/ui/stepper";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUnidadPeso } from "@/lib/context/UnidadPesoContext";
import { displayWeight, displayStep, toKg, unitSuffix } from "@/lib/units";
import type { TipoSet } from "@/lib/db/types";

interface ConfirmedSetRowProps {
  numeroSerie: number;
  pesoKg: number;
  reps: number;
  rir: number | null;
  tipo: TipoSet;
  esPr: boolean;
  onEdit: () => void;
}

// Tocar una serie confirmada la abre para editar — reemplaza el patrón de
// "deshacer con 10s de ventana": ahora se puede corregir cualquier serie
// en cualquier momento, no solo justo después de confirmarla.
export function ConfirmedSetRow({ numeroSerie, pesoKg, reps, rir, tipo, esPr, onEdit }: ConfirmedSetRowProps) {
  const { unidad } = useUnidadPeso();
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex items-center gap-3 rounded-xl bg-surface-raised px-3 py-2.5 text-left active:bg-border"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
        {numeroSerie}
      </span>
      <span className="flex-1 text-lg font-semibold tabular-nums">
        {displayWeight(pesoKg, unidad)}
        {unitSuffix(unidad)} × {reps}
        {rir != null && <span className="ml-2 text-sm font-normal text-muted">RIR {rir}</span>}
      </span>
      {tipo === "CALENTAMIENTO" && <span className="text-xs text-muted">calentamiento</span>}
      {esPr && (
        <span title="PR" className="text-warning">
          ★
        </span>
      )}
      <Pencil className="size-4 shrink-0 text-muted" />
    </button>
  );
}

interface EditableSetFormProps {
  pesoKg: number;
  reps: number;
  rir: number | null;
  incrementoMinimoKg: number;
  onSave: (patch: { pesoKg: number; reps: number; rir: number | null }) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function EditableSetForm({
  pesoKg,
  reps,
  rir,
  incrementoMinimoKg,
  onSave,
  onDelete,
  onCancel,
}: EditableSetFormProps) {
  const { unidad } = useUnidadPeso();
  // Local state stays in kg (the storage unit) — only the Stepper's shown
  // value/step are converted, at the boundary, per spec §7.1.
  const [localPesoKg, setLocalPesoKg] = useState(pesoKg);
  const [localReps, setLocalReps] = useState(reps);
  const [localRir, setLocalRir] = useState(rir);

  return (
    <div className="rounded-2xl border-2 border-primary bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <Stepper
          label={unitSuffix(unidad)}
          value={displayWeight(localPesoKg, unidad)}
          step={displayStep(incrementoMinimoKg, unidad)}
          onChange={(v) => setLocalPesoKg(toKg(v, unidad))}
        />
        <Stepper label="reps" value={localReps} step={1} onChange={setLocalReps} />
      </div>

      <div className="mt-4">
        <span className="text-xs uppercase tracking-wide text-muted">RIR</span>
        <div className="mt-1 flex gap-2">
          {[0, 1, 2, 3, 4].map((n) => (
            <Chip key={n} selected={localRir === n} onClick={() => setLocalRir(n)}>
              {n}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onDelete}
          aria-label="Eliminar serie"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-danger/40 bg-danger/10 text-danger"
        >
          <Trash2 className="size-5" />
        </button>
        <button
          onClick={onCancel}
          aria-label="Cancelar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised"
        >
          <X className="size-5" />
        </button>
        <Button
          size="lg"
          className="flex-1"
          onClick={() => onSave({ pesoKg: localPesoKg, reps: localReps, rir: localRir })}
        >
          <Check className="size-5" />
          Guardar
        </Button>
      </div>
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
  const { unidad } = useUnidadPeso();
  const isWarmup = tipo === "CALENTAMIENTO";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <Stepper
          label={unitSuffix(unidad)}
          value={displayWeight(pesoKg, unidad)}
          step={displayStep(incrementoMinimoKg, unidad)}
          onChange={(v) => onPesoChange(toKg(v, unidad))}
        />
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
