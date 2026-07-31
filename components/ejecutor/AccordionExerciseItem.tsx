"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, SlidersHorizontal } from "lucide-react";
import { DesempenoAnterior } from "./DesempenoAnterior";
import { ConfirmedSetRow, EditableSetForm, SetInputRow } from "./SetRow";
import { useUnidadPeso } from "@/lib/context/UnidadPesoContext";
import { displayWeight, unitSuffix } from "@/lib/units";
import { formatRepsRange, formatDescanso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExerciseContext, SetLogRecord, TipoSet } from "@/lib/db/types";

interface InputState {
  pesoKg: number;
  reps: number;
  rir: number | null;
}

interface AccordionExerciseItemProps {
  exercise: ExerciseContext;
  confirmedSets: SetLogRecord[];
  isCalentamiento: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  editingSetId: string | null;
  onStartEditSet: (id: string) => void;
  onCancelEditSet: () => void;
  onSaveEditSet: (id: string, patch: { pesoKg: number; reps: number; rir: number | null }) => void;
  onDeleteSet: (id: string) => void;
  onConfirmSet: (input: InputState) => void;
  onMolestia: () => void;
  onAbrirAcciones: () => void;
}

function computeInitialInput(exercise: ExerciseContext, confirmedSets: SetLogRecord[]): InputState {
  const last = confirmedSets[confirmedSets.length - 1];
  if (last) return { pesoKg: last.pesoKg, reps: last.reps, rir: last.rir };
  return {
    pesoKg: exercise.objetivoHoy.pesoSugerido ?? 0,
    reps: exercise.objetivoHoy.repsSugeridas ?? exercise.repsMin,
    rir: exercise.rirObjetivo,
  };
}

// Fila colapsada = prescripción del plan (lo que hay que hacer). Expandida
// = el registro real. "grid-template-rows" anima a un alto automático sin
// medir con JS y es una transición CSS interrumpible, no un keyframe.
export function AccordionExerciseItem({
  exercise,
  confirmedSets,
  isCalentamiento,
  expanded,
  onToggleExpand,
  editingSetId,
  onStartEditSet,
  onCancelEditSet,
  onSaveEditSet,
  onDeleteSet,
  onConfirmSet,
  onMolestia,
  onAbrirAcciones,
}: AccordionExerciseItemProps) {
  const { unidad } = useUnidadPeso();
  const [input, setInput] = useState<InputState>(() => computeInitialInput(exercise, confirmedSets));

  // Recalcula el prellenado cuando cambia el número de series confirmadas
  // (justo se registró una) o al cambiar de ejercicio.
  useEffect(() => {
    setInput(computeInitialInput(exercise, confirmedSets));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.exerciseId, confirmedSets.length]);

  const seriesCompletadas = confirmedSets.length;
  const completo = seriesCompletadas >= exercise.seriesObjetivo;
  const sugeridoTexto =
    exercise.objetivoHoy.pesoSugerido != null
      ? `sugerido: ${displayWeight(exercise.objetivoHoy.pesoSugerido, unidad)}${unitSuffix(unidad)}×${exercise.objetivoHoy.repsSugeridas ?? exercise.repsMin}`
      : null;

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-surface", completo ? "border-primary/40" : "border-border")}>
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            completo ? "bg-primary/20 text-primary" : "bg-surface-raised text-muted"
          )}
        >
          {seriesCompletadas}/{exercise.seriesObjetivo}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{exercise.nombre}</span>
            {exercise.condicion && <AlertTriangle className="size-3.5 shrink-0 text-warning" />}
          </div>
          <div className="truncate text-xs text-muted">
            {formatRepsRange(exercise)}
            {exercise.rirObjetivo != null ? ` · RIR ${exercise.rirObjetivo}` : ""} · descanso{" "}
            {formatDescanso(exercise.descansoSeg)}
            {sugeridoTexto ? ` · ${sugeridoTexto}` : ""}
          </div>
        </div>
        <ChevronDown
          className={cn("size-5 shrink-0 text-muted transition-transform duration-200 ease-[var(--ease-out)]", expanded && "rotate-180")}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-250 ease-[var(--ease-out)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 border-t border-border p-4 pt-3">
            {exercise.notas && <p className="text-sm text-muted">{exercise.notas}</p>}

            {exercise.condicion && (
              <div className="rounded-xl bg-warning/15 border border-warning/40 px-3 py-2 text-sm text-warning">
                Condición: {exercise.condicion}
              </div>
            )}

            <DesempenoAnterior sets={exercise.desempenoAnterior} />

            {confirmedSets.length > 0 && (
              <div className="flex flex-col gap-2">
                {confirmedSets.map((s) =>
                  editingSetId === s.id ? (
                    <EditableSetForm
                      key={s.id}
                      pesoKg={s.pesoKg}
                      reps={s.reps}
                      rir={s.rir}
                      incrementoMinimoKg={exercise.incrementoMinimoKg}
                      onSave={(patch) => onSaveEditSet(s.id, patch)}
                      onDelete={() => onDeleteSet(s.id)}
                      onCancel={onCancelEditSet}
                    />
                  ) : (
                    <ConfirmedSetRow
                      key={s.id}
                      numeroSerie={s.numeroSerie}
                      pesoKg={s.pesoKg}
                      reps={s.reps}
                      rir={s.rir}
                      tipo={s.tipo}
                      esPr={false}
                      onEdit={() => onStartEditSet(s.id)}
                    />
                  )
                )}
              </div>
            )}

            <SetInputRow
              pesoKg={input.pesoKg}
              reps={input.reps}
              rir={input.rir}
              tipo={isCalentamiento ? ("CALENTAMIENTO" as TipoSet) : ("TRABAJO" as TipoSet)}
              incrementoMinimoKg={exercise.incrementoMinimoKg}
              onPesoChange={(v) => setInput((prev) => ({ ...prev, pesoKg: v }))}
              onRepsChange={(v) => setInput((prev) => ({ ...prev, reps: v }))}
              onRirChange={(v) => setInput((prev) => ({ ...prev, rir: v }))}
              onTipoChange={() => {}}
              onConfirm={() => onConfirmSet(input)}
              showTipoToggle={false}
            />

            <div className="flex gap-2">
              <button
                onClick={onAbrirAcciones}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface-raised text-sm font-medium"
              >
                <SlidersHorizontal className="size-4" />
                Acciones
              </button>
              <button
                onClick={onMolestia}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 text-sm font-medium text-danger"
              >
                <AlertTriangle className="size-4" />
                Molestia
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
