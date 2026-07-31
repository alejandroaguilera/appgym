import { z } from "zod";

export const bodyMetricSchema = z.object({
  fecha: z.string(),
  pesoKg: z.number().nullable().optional(),
  grasaPct: z.number().nullable().optional(),
  grasaVisceral: z.number().nullable().optional(),
  masaMuscularKg: z.number().nullable().optional(),
  cinturaCm: z.number().nullable().optional(),
  pechoCm: z.number().nullable().optional(),
  brazoDCm: z.number().nullable().optional(),
  musloDCm: z.number().nullable().optional(),
  cuelloCm: z.number().nullable().optional(),
  caderaCm: z.number().nullable().optional(),
  fuente: z.enum(["MANUAL", "OMRON_CSV", "API"]).default("MANUAL"),
});

export type BodyMetricInput = z.infer<typeof bodyMetricSchema>;
