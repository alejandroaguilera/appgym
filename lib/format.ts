import type { ExerciseContext } from "@/lib/db/types";

export function formatRepsRange(exercise: Pick<ExerciseContext, "repsMin" | "repsMax" | "unidadReps">): string {
  const { repsMin, repsMax, unidadReps } = exercise;
  const range = repsMax != null && repsMax !== repsMin ? `${repsMin}-${repsMax}` : `${repsMin}`;
  return unidadReps === "SEGUNDOS" ? `${range} s` : `${range} reps`;
}

export function formatDescanso(descansoSeg: number): string {
  if (descansoSeg < 60) return `${descansoSeg} s`;
  if (descansoSeg % 60 === 0) return `${descansoSeg / 60} min`;
  const min = Math.floor(descansoSeg / 60);
  const seg = descansoSeg % 60;
  return `${min}:${String(seg).padStart(2, "0")} min`;
}
