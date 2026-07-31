"use client";

import { AlertTriangle, SlidersHorizontal } from "lucide-react";
import { ObjetivoHoy } from "./ObjetivoHoy";
import { DesempenoAnterior } from "./DesempenoAnterior";
import { ConfirmedSetRow, SetInputRow } from "./SetRow";
import type { ExerciseContext, SetLogRecord, TipoSet } from "@/lib/db/types";

interface InputState {
  pesoKg: number;
  reps: number;
  rir: number | null;
  tipo: TipoSet;
}

interface ExerciseCardProps {
  exercise: ExerciseContext;
  confirmedSets: SetLogRecord[];
  input: InputState;
  onInputChange: (patch: Partial<InputState>) => void;
  onConfirm: () => void;
  onMolestia: () => void;
  onAbrirAcciones: () => void;
}

export function ExerciseCard({
  exercise,
  confirmedSets,
  input,
  onInputChange,
  onConfirm,
  onMolestia,
  onAbrirAcciones,
}: ExerciseCardProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{exercise.nombre}</h2>
          {exercise.notas && <p className="text-sm text-muted">{exercise.notas}</p>}
        </div>
        <button
          onClick={onAbrirAcciones}
          aria-label="Acciones del ejercicio"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised"
        >
          <SlidersHorizontal className="size-5" />
        </button>
      </div>

      {exercise.condicion && (
        <div className="rounded-xl bg-warning/15 border border-warning/40 px-3 py-2 text-sm text-warning">
          Condición: {exercise.condicion}
        </div>
      )}

      <ObjetivoHoy texto={exercise.objetivoHoy.texto} />
      <DesempenoAnterior sets={exercise.desempenoAnterior} />

      <div className="flex flex-col gap-2">
        {confirmedSets.map((s) => (
          <ConfirmedSetRow
            key={s.id}
            numeroSerie={s.numeroSerie}
            pesoKg={s.pesoKg}
            reps={s.reps}
            rir={s.rir}
            tipo={s.tipo}
            esPr={false}
          />
        ))}
      </div>

      <SetInputRow
        pesoKg={input.pesoKg}
        reps={input.reps}
        rir={input.rir}
        tipo={input.tipo}
        incrementoMinimoKg={exercise.incrementoMinimoKg}
        onPesoChange={(v) => onInputChange({ pesoKg: v })}
        onRepsChange={(v) => onInputChange({ reps: v })}
        onRirChange={(v) => onInputChange({ rir: v })}
        onTipoChange={(v) => onInputChange({ tipo: v })}
        onConfirm={onConfirm}
      />

      <button
        onClick={onMolestia}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 text-sm font-medium text-danger"
      >
        <AlertTriangle className="size-4" />
        Reportar molestia
      </button>
    </div>
  );
}
