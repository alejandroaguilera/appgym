"use client";

import { SlidersHorizontal } from "lucide-react";
import { ObjetivoHoy } from "./ObjetivoHoy";
import { formatRepsRange, formatDescanso } from "@/lib/format";
import type { ExerciseContext } from "@/lib/db/types";

interface ExerciseHeaderProps {
  exercise: ExerciseContext;
  seriesCompletadas: number;
  onAbrirAcciones: () => void;
}

// Nombre y "objetivo hoy" van antes del temporizador de descanso — es lo
// primero que el atleta necesita ver al llegar al ejercicio, el descanso
// es secundario hasta que arranca.
export function ExerciseHeader({ exercise, seriesCompletadas, onAbrirAcciones }: ExerciseHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
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

      {/* La prescripción del plan: cuántas series, reps y RIR toca hacer,
          y cuánto descansar — se calculaba pero nunca se mostraba como tal. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface-raised px-3 py-2 text-sm">
        <span className="font-semibold text-foreground">
          {seriesCompletadas}/{exercise.seriesObjetivo} series
        </span>
        <span className="text-muted">· {formatRepsRange(exercise)}</span>
        {exercise.rirObjetivo != null && <span className="text-muted">· RIR {exercise.rirObjetivo}</span>}
        <span className="text-muted">· descanso {formatDescanso(exercise.descansoSeg)}</span>
      </div>

      {exercise.condicion && (
        <div className="rounded-xl bg-warning/15 border border-warning/40 px-3 py-2 text-sm text-warning">
          Condición: {exercise.condicion}
        </div>
      )}

      <ObjetivoHoy texto={exercise.objetivoHoy.texto} />
    </div>
  );
}
