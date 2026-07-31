"use client";

import { Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TemplateExerciseRow, type TemplateExerciseFormState } from "./TemplateExerciseRow";

export interface SessionTemplateFormState {
  key: string;
  clave: string;
  nombre: string;
  duracionEstimadaMin: number | null;
  notas: string;
  templateExercises: TemplateExerciseFormState[];
}

interface SessionTemplateEditorProps {
  value: SessionTemplateFormState;
  onChange: (value: SessionTemplateFormState) => void;
  onRemove: () => void;
}

function newExerciseRow(): TemplateExerciseFormState {
  return {
    key: crypto.randomUUID(),
    exerciseId: "",
    exerciseNombre: "",
    seriesObjetivo: 3,
    repsMin: 8,
    repsMax: 12,
    unidadReps: "REPS",
    rirObjetivo: 2,
    descansoSeg: 90,
    notas: "",
    esOpcional: false,
    condicion: "",
  };
}

export function SessionTemplateEditor({ value, onChange, onRemove }: SessionTemplateEditorProps) {
  function updateExercise(index: number, ex: TemplateExerciseFormState) {
    const templateExercises = value.templateExercises.map((e, i) => (i === index ? ex : e));
    onChange({ ...value, templateExercises });
  }

  function removeExercise(index: number) {
    onChange({ ...value, templateExercises: value.templateExercises.filter((_, i) => i !== index) });
  }

  function move(index: number, delta: number) {
    const arr = [...value.templateExercises];
    const target = index + delta;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    onChange({ ...value, templateExercises: arr });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Input
          className="w-16"
          maxLength={1}
          value={value.clave}
          onChange={(e) => onChange({ ...value, clave: e.target.value.toUpperCase() })}
        />
        <Input
          className="flex-1"
          placeholder="Nombre de la sesión"
          value={value.nombre}
          onChange={(e) => onChange({ ...value, nombre: e.target.value })}
        />
        <button onClick={onRemove} aria-label="Eliminar sesión" className="flex h-11 w-11 items-center justify-center text-danger">
          <Trash2 className="size-5" />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {value.templateExercises.map((ex, i) => (
          <TemplateExerciseRow
            key={ex.key}
            value={ex}
            onChange={(v) => updateExercise(i, v)}
            onRemove={() => removeExercise(i)}
            onMoveUp={() => move(i, -1)}
            onMoveDown={() => move(i, 1)}
            canMoveUp={i > 0}
            canMoveDown={i < value.templateExercises.length - 1}
          />
        ))}
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => onChange({ ...value, templateExercises: [...value.templateExercises, newExerciseRow()] })}
      >
        <Plus className="size-4" />
        Agregar ejercicio
      </Button>
    </div>
  );
}

export { newExerciseRow };
