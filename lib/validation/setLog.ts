import { z } from "zod";

export const setLogSchema = z.object({
  id: z.string().uuid(),
  sessionLogId: z.string().uuid(),
  exerciseId: z.string(),
  numeroSerie: z.number().int().min(1),
  pesoKg: z.number().min(0),
  reps: z.number().int().min(0),
  rir: z.number().int().min(0).max(4).nullable(),
  tipo: z.enum(["TRABAJO", "CALENTAMIENTO", "DROPSET", "FALLO"]),
  completadaEn: z.string().datetime(),
  descansoRealSeg: z.number().int().nullable(),
  notas: z.string().nullable(),
  molestiaFlag: z.boolean(),
  molestiaZona: z.string().nullable(),
  molestiaNivel1a10: z.number().int().min(1).max(10).nullable(),
  version: z.number().int().min(1).default(1),
});

export type SetLogInput = z.infer<typeof setLogSchema>;
