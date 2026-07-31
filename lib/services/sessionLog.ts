import { prisma } from "@/lib/prisma";
import { sessionLogSchema, type SessionLogInput } from "@/lib/validation/session";

// Idempotent by id: resending the same SessionLog (e.g. via the pagehide
// sendBeacon fallback racing the normal outbox drain) is always safe —
// it's a plain upsert, never a duplicate insert. §5.2/§5.3.
export async function upsertSessionLog(input: SessionLogInput) {
  const data = sessionLogSchema.parse(input);
  return prisma.sessionLog.upsert({
    where: { id: data.id },
    create: {
      id: data.id,
      atletaId: data.atletaId,
      scheduledSessionId: data.scheduledSessionId,
      sessionTemplateId: data.sessionTemplateId,
      iniciadaEn: new Date(data.iniciadaEn),
      finalizadaEn: data.finalizadaEn ? new Date(data.finalizadaEn) : null,
      estado: data.estado,
      duracionActivaSeg: data.duracionActivaSeg,
      energia1a5: data.energia1a5,
      suenoHorasPrevias: data.suenoHorasPrevias,
      pesoCorporalKg: data.pesoCorporalKg,
      notas: data.notas,
      sincronizadaEn: new Date(),
    },
    update: {
      finalizadaEn: data.finalizadaEn ? new Date(data.finalizadaEn) : null,
      estado: data.estado,
      duracionActivaSeg: data.duracionActivaSeg,
      energia1a5: data.energia1a5,
      suenoHorasPrevias: data.suenoHorasPrevias,
      pesoCorporalKg: data.pesoCorporalKg,
      notas: data.notas,
      sincronizadaEn: new Date(),
    },
  });
}
