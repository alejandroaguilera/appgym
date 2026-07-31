import { prisma } from "@/lib/prisma";
import { setLogSchema, type SetLogInput } from "@/lib/validation/setLog";

// Idempotent by id. §5.7 conflict rule (latest timestamp_cliente wins) is
// approximated here via `version`: an incoming write only overwrites an
// existing row if its version is >= the stored one, so a stale resend from
// a slow device can't clobber a newer edit. Full audit-log retention of the
// superseded version is deferred — out of scope for this single-device v1,
// flagged rather than silently dropped.
export async function upsertSetLog(sessionLogId: string, input: SetLogInput) {
  const data = setLogSchema.parse({ ...input, sessionLogId });

  const existing = await prisma.setLog.findUnique({ where: { id: data.id } });
  if (existing && existing.version > data.version) {
    return existing;
  }

  return prisma.setLog.upsert({
    where: { id: data.id },
    create: {
      id: data.id,
      sessionLogId: data.sessionLogId,
      exerciseId: data.exerciseId,
      numeroSerie: data.numeroSerie,
      pesoKg: data.pesoKg,
      reps: data.reps,
      rir: data.rir,
      tipo: data.tipo,
      completadaEn: new Date(data.completadaEn),
      descansoRealSeg: data.descansoRealSeg,
      notas: data.notas,
      molestiaFlag: data.molestiaFlag,
      molestiaZona: data.molestiaZona,
      molestiaNivel1a10: data.molestiaNivel1a10,
      version: data.version,
    },
    update: {
      pesoKg: data.pesoKg,
      reps: data.reps,
      rir: data.rir,
      tipo: data.tipo,
      descansoRealSeg: data.descansoRealSeg,
      notas: data.notas,
      molestiaFlag: data.molestiaFlag,
      molestiaZona: data.molestiaZona,
      molestiaNivel1a10: data.molestiaNivel1a10,
      version: data.version,
    },
  });
}

export async function deleteSetLog(id: string) {
  await prisma.setLog.deleteMany({ where: { id } });
}
