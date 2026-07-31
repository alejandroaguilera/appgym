import { z } from "zod";
import { GRUPOS_MUSCULARES } from "@/lib/muscle-groups";

export const exercisePatchSchema = z.object({
  nombre: z.string().min(1).optional(),
  grupoMuscularPrimario: z.enum(GRUPOS_MUSCULARES).optional(),
  gruposSecundarios: z.array(z.string()).optional(),
  instrucciones: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
});

export type ExercisePatchInput = z.infer<typeof exercisePatchSchema>;
