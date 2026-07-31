import { z } from "zod";

export const templateExerciseSchema = z.object({
  id: z.string().optional(),
  exerciseId: z.string(),
  orden: z.number().int(),
  seriesObjetivo: z.number().int().min(1),
  repsMin: z.number().int().min(1),
  repsMax: z.number().int().nullable(),
  unidadReps: z.enum(["REPS", "SEGUNDOS"]).default("REPS"),
  rirObjetivo: z.number().int().min(0).max(4).nullable(),
  descansoSeg: z.number().int().min(0),
  notas: z.string().nullable().optional(),
  agrupacion: z.string().nullable().optional(),
  esOpcional: z.boolean().default(false),
  condicion: z.string().nullable().optional(),
});

export const sessionTemplateSchema = z.object({
  id: z.string().optional(),
  clave: z.string().min(1).max(1),
  nombre: z.string().min(1),
  orden: z.number().int(),
  notas: z.string().nullable().optional(),
  duracionEstimadaMin: z.number().int().nullable().optional(),
  templateExercises: z.array(templateExerciseSchema),
});

export const weekOverrideSchema = z.object({
  numeroSemana: z.number().int().min(1),
  deltaSeries: z.number().int().default(0),
  rirObjetivo: z.number().int().min(0).max(4).nullable(),
  nota: z.string().nullable().optional(),
});

export const blockSchema = z.object({
  nombre: z.string().min(1),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  estado: z.enum(["BORRADOR", "ACTIVO", "COMPLETADO", "ARCHIVADO"]).default("BORRADOR"),
  notas: z.string().nullable().optional(),
  sessionTemplates: z.array(sessionTemplateSchema),
  weekOverrides: z.array(weekOverrideSchema),
});

export type BlockInput = z.infer<typeof blockSchema>;
