"use client";

import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";

export interface ExerciseOption {
  id: string;
  nombre: string;
}

export interface TemplateExerciseFormState {
  key: string;
  exerciseId: string;
  exerciseNombre: string;
  seriesObjetivo: number;
  repsMin: number;
  repsMax: number | null;
  unidadReps: "REPS" | "SEGUNDOS";
  rirObjetivo: number | null;
  descansoSeg: number;
  notas: string;
  esOpcional: boolean;
  condicion: string;
}

interface TemplateExerciseRowProps {
  value: TemplateExerciseFormState;
  onChange: (value: TemplateExerciseFormState) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function TemplateExerciseRow({
  value,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: TemplateExerciseRowProps) {
  const [query, setQuery] = useState(value.exerciseNombre);
  const [results, setResults] = useState<ExerciseOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searching) return;
    const id = setTimeout(() => {
      fetch(`/api/exercises?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.exercises ?? []));
    }, 200);
    return () => clearTimeout(id);
  }, [query, searching]);

  function pick(ex: ExerciseOption) {
    onChange({ ...value, exerciseId: ex.id, exerciseNombre: ex.nombre });
    setQuery(ex.nombre);
    setSearching(false);
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-3">
      <div className="flex items-start gap-2">
        {/* Reorder via up/down buttons rather than drag — simpler and keyboard-accessible (spec §8) */}
        <div className="flex flex-col gap-1">
          <button
            disabled={!canMoveUp}
            onClick={onMoveUp}
            className="flex h-7 w-7 items-center justify-center rounded border border-border disabled:opacity-30"
            aria-label="Mover arriba"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            disabled={!canMoveDown}
            onClick={onMoveDown}
            className="flex h-7 w-7 items-center justify-center rounded border border-border disabled:opacity-30"
            aria-label="Mover abajo"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>

        <div className="flex-1">
          <Input
            placeholder="Buscar ejercicio..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearching(true);
            }}
          />
          {searching && results.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 rounded-xl border border-border bg-surface p-1">
              {results.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => pick(ex)}
                  className="rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-raised"
                >
                  {ex.nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={onRemove} aria-label="Eliminar ejercicio" className="flex h-9 w-9 items-center justify-center text-danger">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        <Field label="Series">
          <Input
            type="number"
            value={value.seriesObjetivo}
            onChange={(e) => onChange({ ...value, seriesObjetivo: Number(e.target.value) })}
          />
        </Field>
        <Field label="Reps min">
          <Input
            type="number"
            value={value.repsMin}
            onChange={(e) => onChange({ ...value, repsMin: Number(e.target.value) })}
          />
        </Field>
        <Field label="Reps max">
          <Input
            type="number"
            value={value.repsMax ?? ""}
            onChange={(e) => onChange({ ...value, repsMax: e.target.value ? Number(e.target.value) : null })}
          />
        </Field>
        <Field label="Descanso (s)">
          <Input
            type="number"
            value={value.descansoSeg}
            onChange={(e) => onChange({ ...value, descansoSeg: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted">RIR</span>
        {[0, 1, 2, 3, 4].map((n) => (
          <Chip
            key={n}
            selected={value.rirObjetivo === n}
            onClick={() => onChange({ ...value, rirObjetivo: value.rirObjetivo === n ? null : n })}
            className="!h-8 !min-w-8 !px-2.5 text-xs"
          >
            {n}
          </Chip>
        ))}
      </div>

      <Input
        className="mt-2"
        placeholder="Notas..."
        value={value.notas}
        onChange={(e) => onChange({ ...value, notas: e.target.value })}
      />
      <Input
        className="mt-2"
        placeholder='Condición (ej. "solo a partir de semana 3...")'
        value={value.condicion}
        onChange={(e) => onChange({ ...value, condicion: e.target.value })}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase text-muted">{label}</span>
      {children}
    </label>
  );
}
