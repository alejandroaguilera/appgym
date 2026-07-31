import { z } from "zod";

export const sessionLogSchema = z.object({
  id: z.string().uuid(),
  atletaId: z.string(),
  scheduledSessionId: z.string().nullable(),
  sessionTemplateId: z.string().nullable(),
  iniciadaEn: z.string().datetime(),
  finalizadaEn: z.string().datetime().nullable(),
  estado: z.enum(["EN_PROGRESO", "COMPLETADA", "ABANDONADA"]),
  duracionActivaSeg: z.number().int().nullable(),
  energia1a5: z.number().int().min(1).max(5).nullable(),
  suenoHorasPrevias: z.number().nullable(),
  pesoCorporalKg: z.number().nullable(),
  notas: z.string().nullable(),
});

export type SessionLogInput = z.infer<typeof sessionLogSchema>;
