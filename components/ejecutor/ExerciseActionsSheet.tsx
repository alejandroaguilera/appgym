"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ExerciseOption {
  id: string;
  nombre: string;
  incrementoMinimoKg: number;
}

interface ExerciseActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSustituir: (exercise: ExerciseOption) => void;
  onAgregarEjercicio: (exercise: ExerciseOption) => void;
  onAgregarSerie: () => void;
  onQuitarSerie: () => void;
  // El botón "+ agregar ejercicio" de nivel de sesión abre este sheet
  // directo en modo búsqueda, sin pasar por el menú de un ejercicio
  // específico (sustituir/series no aplican ahí).
  initialMode?: Mode;
}

type Mode = "menu" | "sustituir" | "agregar";

// Sustituir/saltar/agregar sobre la marcha (spec §4.4) — el gym está lleno,
// la máquina está ocupada, pasa siempre.
export function ExerciseActionsSheet({
  open,
  onOpenChange,
  onSustituir,
  onAgregarEjercicio,
  onAgregarSerie,
  onQuitarSerie,
  initialMode = "menu",
}: ExerciseActionsSheetProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExerciseOption[]>([]);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (mode === "menu") return;
    const id = setTimeout(() => {
      fetch(`/api/exercises?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.exercises ?? []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(id);
  }, [query, mode]);

  function pick(exercise: ExerciseOption) {
    if (mode === "sustituir") onSustituir(exercise);
    if (mode === "agregar") onAgregarEjercicio(exercise);
    setQuery("");
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "menu" ? "Ejercicio" : "Buscar ejercicio"}
    >
      {mode === "menu" ? (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="lg" className="justify-start" onClick={() => setMode("sustituir")}>
            Sustituir ejercicio
          </Button>
          <Button variant="secondary" size="lg" className="justify-start" onClick={() => setMode("agregar")}>
            Agregar ejercicio
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="justify-start"
            onClick={() => {
              onAgregarSerie();
              onOpenChange(false);
            }}
          >
            Agregar serie extra
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="justify-start"
            onClick={() => {
              onQuitarSerie();
              onOpenChange(false);
            }}
          >
            Quitar una serie planeada
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Input autoFocus placeholder="Buscar..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {results.map((ex) => (
              <button
                key={ex.id}
                onClick={() => pick(ex)}
                className="rounded-xl bg-surface-raised px-3 py-3 text-left text-base"
              >
                {ex.nombre}
              </button>
            ))}
            {results.length === 0 && <p className="text-sm text-muted">Sin resultados.</p>}
          </div>
        </div>
      )}
    </Sheet>
  );
}
