import { applyWeekOverride } from "./week-resolve";
import type { UnidadReps } from "@prisma/client";

// Cuánto descansar cuando la prescripción del coach no lo dice y el ejercicio
// tampoco está en la plantilla del bloque (es decir, lo metió el coach esta
// semana). Dos minutos es el descanso que usa el resto del plan.
const DESCANSO_POR_DEFECTO_SEG = 120;

interface ExerciseLite {
  id: string;
  nombre: string;
  grupoMuscularPrimario: string;
  incrementoMinimoKg: number;
}

interface TemplateExerciseLite {
  id: string;
  exerciseId: string;
  orden: number;
  seriesObjetivo: number;
  repsMin: number;
  repsMax: number | null;
  unidadReps: UnidadReps;
  rirObjetivo: number | null;
  descansoSeg: number;
  notas: string | null;
  esOpcional: boolean;
  condicion: string | null;
  exercise: ExerciseLite;
}

interface PrescriptionLite {
  exerciseId: string;
  orden: number;
  seriesObjetivo: number;
  repsMin: number;
  repsMax: number | null;
  rirObjetivo: number | null;
  pesoObjetivoKg: number | null;
  descansoSeg: number | null;
  nota: string | null;
  exercise: ExerciseLite;
}

interface OverrideLite {
  numeroSemana: number;
  deltaSeries: number;
  rirObjetivo: number | null;
  nota: string | null;
}

export interface PlanItem {
  // De dónde salió esta línea. La app lo usa para etiquetar el objetivo como
  // del coach en vez de presentarlo como un cálculo suyo.
  origen: "coach" | "plantilla";
  templateExerciseId: string | null;
  exerciseId: string;
  orden: number;
  seriesObjetivo: number;
  repsMin: number;
  repsMax: number | null;
  unidadReps: UnidadReps;
  rirObjetivo: number | null;
  descansoSeg: number;
  // Sólo lo llena el coach. null = que la app calcule por doble progresión.
  pesoObjetivoKg: number | null;
  notas: string | null;
  esOpcional: boolean;
  condicion: string | null;
  exercise: ExerciseLite;
}

// Qué ejercicios toca hacer en esta sesión, esta semana.
//
// Si el coach prescribió esta (semana, plantilla), sus filas son la lista
// COMPLETA — no un parche sobre la plantilla. Es lo que le permite meter y
// sacar ejercicios sin tocar el bloque, y lo que hace que "la del coach manda"
// sea cierto y no una mezcla ambigua de dos fuentes.
//
// El WeekOverride del bloque no se aplica encima de una prescripción: el coach
// ya dijo series y RIR explícitamente, sumarle un deltaSeries encima daría un
// número que nadie pidió.
export function resolveWeekPlan(
  templateExercises: TemplateExerciseLite[],
  prescriptions: PrescriptionLite[],
  override: OverrideLite | null
): PlanItem[] {
  if (prescriptions.length > 0) {
    const porEjercicio = new Map(templateExercises.map((te) => [te.exerciseId, te]));
    return [...prescriptions]
      .sort((a, b) => a.orden - b.orden)
      .map((p) => {
        const te = porEjercicio.get(p.exerciseId);
        return {
          origen: "coach" as const,
          templateExerciseId: te?.id ?? null,
          exerciseId: p.exerciseId,
          orden: p.orden,
          seriesObjetivo: p.seriesObjetivo,
          repsMin: p.repsMin,
          repsMax: p.repsMax,
          unidadReps: te?.unidadReps ?? ("REPS" as UnidadReps),
          rirObjetivo: p.rirObjetivo,
          descansoSeg: p.descansoSeg ?? te?.descansoSeg ?? DESCANSO_POR_DEFECTO_SEG,
          pesoObjetivoKg: p.pesoObjetivoKg,
          // La nota del coach reemplaza la de la plantilla, nunca se suman:
          // dos prescripciones de semanas distintas juntas en pantalla es
          // peor que una sola, aunque esté incompleta.
          notas: p.nota,
          // Lo que el coach prescribe para una semana no es opcional: si lo
          // puso, lo puso. Lo opcional vive en la plantilla del bloque.
          esOpcional: false,
          condicion: te?.condicion ?? null,
          exercise: p.exercise,
        };
      });
  }

  return [...templateExercises]
    .sort((a, b) => a.orden - b.orden)
    .map((te) => {
      const { seriesObjetivo, rirObjetivo } = applyWeekOverride(te.seriesObjetivo, te.rirObjetivo, override);
      return {
        origen: "plantilla" as const,
        templateExerciseId: te.id,
        exerciseId: te.exerciseId,
        orden: te.orden,
        seriesObjetivo,
        repsMin: te.repsMin,
        repsMax: te.repsMax,
        unidadReps: te.unidadReps,
        rirObjetivo,
        descansoSeg: te.descansoSeg,
        pesoObjetivoKg: null,
        notas: te.notas,
        esOpcional: te.esOpcional,
        condicion: te.condicion,
        exercise: te.exercise,
      };
    });
}
