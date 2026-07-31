"use client";

import { AlertTriangle } from "lucide-react";
import { DesempenoAnterior } from "./DesempenoAnterior";
import { ConfirmedSetRow, EditableSetForm, SetInputRow } from "./SetRow";
import type { ExerciseContext, SetLogRecord, TipoSet } from "@/lib/db/types";

interface InputState {
  pesoKg: number;
  reps: number;
  rir: number | null;
  tipo: TipoSet;
}

interface ExerciseBodyProps {
  exercise: ExerciseContext;
  confirmedSets: SetLogRecord[];
  editingSetId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, patch: { pesoKg: number; reps: number; rir: number | null }) => void;
  onDeleteSet: (id: string) => void;
  input: InputState;
  onInputChange: (patch: Partial<InputState>) => void;
  onConfirm: () => void;
  onMolestia: () => void;
}

export function ExerciseBody({
  exercise,
  confirmedSets,
  editingSetId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDeleteSet,
  input,
  onInputChange,
  onConfirm,
  onMolestia,
}: ExerciseBodyProps) {
  return (
    <div className="flex flex-col gap-4">
      <DesempenoAnterior sets={exercise.desempenoAnterior} />

      <div className="flex flex-col gap-2">
        {confirmedSets.map((s) =>
          editingSetId === s.id ? (
            <EditableSetForm
              key={s.id}
              pesoKg={s.pesoKg}
              reps={s.reps}
              rir={s.rir}
              incrementoMinimoKg={exercise.incrementoMinimoKg}
              onSave={(patch) => onSaveEdit(s.id, patch)}
              onDelete={() => onDeleteSet(s.id)}
              onCancel={onCancelEdit}
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
              onEdit={() => onStartEdit(s.id)}
            />
          )
        )}
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
