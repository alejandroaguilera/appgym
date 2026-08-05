import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";
import { getOrCreateOpenCycle } from "@/lib/logic/week-cycle";
import { buildWeekSummary, mensajeFallback, resumenMarkdown } from "@/lib/logic/week-summary";
import { grokMensajeSemanal } from "@/lib/ai/xai";
import { SET_NO_CALENTAMIENTO } from "@/lib/logic/volumen";

// Mensaje de cierre de semana. Sólo responde cuando el ciclo abierto está
// realmente completo — el cliente lo llama al detectar `semana.completada`,
// pero la verificación se rehace aquí para no depender de que el cliente la
// haya hecho bien.
//
// Idempotente por diseño: el mensaje se cachea en el ciclo, así que recargar
// Hoy no dispara otra llamada a Grok ni cambia el texto que el atleta ya vio.
export async function POST() {
  const atletaId = await getAthleteId();

  const block = await prisma.block.findFirst({
    where: { atletaId, estado: "ACTIVO" },
    select: { id: true, nombre: true, sessionTemplates: { select: { id: true } } },
  });
  if (!block) return NextResponse.json({ error: "sin bloque activo" }, { status: 404 });

  const cycle = await getOrCreateOpenCycle(atletaId, block.id);
  const templateIds = block.sessionTemplates.map((t) => t.id);

  // Mismo `in` que /api/today: acotado a las plantillas del bloque activo, o
  // sesiones de bloques anteriores completarían la semana por su cuenta.
  const completadas = await prisma.sessionLog.findMany({
    where: {
      atletaId,
      estado: "COMPLETADA",
      sessionTemplateId: { in: templateIds },
      finalizadaEn: { gte: cycle.iniciadaEn },
      setLogs: { some: SET_NO_CALENTAMIENTO },
    },
    select: { sessionTemplateId: true },
  });
  const distintas = new Set(completadas.map((s) => s.sessionTemplateId)).size;

  if (templateIds.length === 0 || distintas < templateIds.length) {
    return NextResponse.json({ error: "la semana todavía no está completa" }, { status: 409 });
  }

  const cicloAnterior = await prisma.weekCycle.findUnique({
    where: { blockId_numeroSemana: { blockId: block.id, numeroSemana: cycle.numeroSemana - 1 } },
    select: { numeroSemana: true, iniciadaEn: true, cerradaEn: true },
  });

  const resumen = await buildWeekSummary(atletaId, block, cycle, cicloAnterior);

  if (cycle.mensaje) {
    return NextResponse.json({
      cicloId: cycle.id,
      mensaje: cycle.mensaje,
      origen: cycle.mensajeOrigen ?? "FALLBACK",
      resumen,
      resumenMarkdown: resumenMarkdown(resumen),
    });
  }

  const generado = await grokMensajeSemanal(resumen);
  const mensaje = generado ?? mensajeFallback(resumen);
  const origen = generado ? "IA" : "FALLBACK";

  await prisma.weekCycle.update({
    where: { id: cycle.id },
    data: { mensaje, mensajeOrigen: origen },
  });

  return NextResponse.json({
    cicloId: cycle.id,
    mensaje,
    origen,
    resumen,
    resumenMarkdown: resumenMarkdown(resumen),
  });
}
