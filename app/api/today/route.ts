import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";
import { siguienteEnCiclo } from "@/lib/logic/next-session";
import { getOrCreateOpenCycle } from "@/lib/logic/week-cycle";
import { resolveWeekOverride, applyWeekOverride } from "@/lib/logic/week-resolve";
import { calcObjetivoHoy } from "@/lib/logic/objetivo-hoy";
import { SET_NO_CALENTAMIENTO } from "@/lib/logic/volumen";
import { localDayString } from "@/lib/date";

export async function GET(req: NextRequest) {
  const atletaId = await getAthleteId();
  const requestedTemplateId = req.nextUrl.searchParams.get("sessionTemplateId");

  const block = await prisma.block.findFirst({
    where: { atletaId, estado: "ACTIVO" },
    include: {
      sessionTemplates: {
        orderBy: { orden: "asc" },
        include: { templateExercises: { orderBy: { orden: "asc" }, include: { exercise: true } } },
      },
      weekOverrides: true,
    },
  });

  if (!block) {
    return NextResponse.json({ atletaId, block: null });
  }

  const today = new Date();
  const cycle = await getOrCreateOpenCycle(atletaId, block.id);
  const numeroSemana = cycle.numeroSemana;
  const override = resolveWeekOverride(block.weekOverrides, numeroSemana);

  // Sesiones del bloque ya completadas en el ciclo de semana abierto. Antes
  // esto miraba sólo el día calendario local, así que lo entrenado el lunes
  // dejaba de verse completado el martes aunque la semana siguiera en curso.
  // El filtro SET_NO_CALENTAMIENTO es el mismo del resto del endpoint: ignora
  // sesiones vacías o de prueba.
  //
  // El `in` sobre las plantillas del bloque activo no es decorativo: con
  // `{ not: null }` entraban sesiones de bloques anteriores cuyas plantillas
  // ya no están en este, y la cuenta llegaba a "semana completa" con sesiones
  // reales todavía pendientes. La ventana de un día lo tapaba; la del ciclo no.
  const templateIds = block.sessionTemplates.map((t) => t.id);
  const completadasEnCiclo = await prisma.sessionLog.findMany({
    where: {
      atletaId,
      estado: "COMPLETADA",
      sessionTemplateId: { in: templateIds },
      finalizadaEn: { gte: cycle.iniciadaEn },
      setLogs: { some: SET_NO_CALENTAMIENTO },
    },
    orderBy: { finalizadaEn: "desc" },
    select: { sessionTemplateId: true },
  });
  const completedTemplateIds = [
    ...new Set(completadasEnCiclo.map((s) => s.sessionTemplateId as string)),
  ];

  let sessionTemplate = requestedTemplateId
    ? block.sessionTemplates.find((t) => t.id === requestedTemplateId)
    : undefined;

  if (!sessionTemplate) {
    const lastCompleted = await prisma.sessionLog.findFirst({
      // Una sesión COMPLETADA sin ninguna serie de trabajo real no cuenta
      // como "entrenamiento hecho" para decidir la siguiente en la rotación
      // A→B→C→D — evita que sesiones de prueba vacías la desvíen.
      where: {
        atletaId,
        estado: "COMPLETADA",
        sessionTemplateId: { not: null },
        setLogs: { some: SET_NO_CALENTAMIENTO },
      },
      orderBy: { finalizadaEn: "desc" },
    });
    const next = siguienteEnCiclo(
      block.sessionTemplates,
      completedTemplateIds,
      lastCompleted?.sessionTemplateId ?? null
    );
    sessionTemplate = block.sessionTemplates.find((t) => t.id === next.id);
  }

  if (!sessionTemplate) {
    return NextResponse.json({ block: { id: block.id, nombre: block.nombre }, sessionTemplate: null });
  }

  const exercises = await Promise.all(
    sessionTemplate.templateExercises.map(async (te) => {
      const ultimaSesion = await prisma.setLog.findFirst({
        where: { exerciseId: te.exerciseId, tipo: "TRABAJO", sessionLog: { atletaId, estado: "COMPLETADA" } },
        orderBy: { completadaEn: "desc" },
        select: { sessionLogId: true },
      });

      const ultimaSesionSets = ultimaSesion
        ? await prisma.setLog.findMany({
            where: { sessionLogId: ultimaSesion.sessionLogId, exerciseId: te.exerciseId, tipo: "TRABAJO" },
            orderBy: { numeroSerie: "asc" },
            select: { pesoKg: true, reps: true, rir: true },
          })
        : [];

      const { rirObjetivo } = applyWeekOverride(te.seriesObjetivo, te.rirObjetivo, override);

      const objetivoHoy = calcObjetivoHoy({
        ultimaSesionSetsTrabajo: ultimaSesionSets,
        repsMin: te.repsMin,
        repsMax: te.repsMax,
        rirObjetivo,
        incrementoMinimoKg: te.exercise.incrementoMinimoKg,
      });

      return {
        templateExerciseId: te.id,
        exerciseId: te.exerciseId,
        nombre: te.exercise.nombre,
        grupoMuscularPrimario: te.exercise.grupoMuscularPrimario,
        notas: te.notas,
        seriesObjetivo: applyWeekOverride(te.seriesObjetivo, te.rirObjetivo, override).seriesObjetivo,
        repsMin: te.repsMin,
        repsMax: te.repsMax,
        unidadReps: te.unidadReps,
        rirObjetivo,
        descansoSeg: te.descansoSeg,
        incrementoMinimoKg: te.exercise.incrementoMinimoKg,
        condicion: te.condicion,
        esOpcional: te.esOpcional,
        objetivoHoy,
        desempenoAnterior: ultimaSesionSets,
      };
    })
  );

  const todayStr = localDayString(today);
  let metricaActual = await prisma.bodyMetric.findUnique({
    where: { atletaId_fecha: { atletaId, fecha: new Date(todayStr) } },
  });
  const esDeHoy = metricaActual != null;
  if (!metricaActual) {
    metricaActual = await prisma.bodyMetric.findFirst({ where: { atletaId }, orderBy: { fecha: "desc" } });
  }

  return NextResponse.json({
    atletaId,
    block: { id: block.id, nombre: block.nombre, fechaInicio: block.fechaInicio, fechaFin: block.fechaFin },
    numeroSemana,
    focoSemana: override?.nota ?? null,
    sessionTemplates: block.sessionTemplates.map((t) => ({
      id: t.id,
      clave: t.clave,
      nombre: t.nombre,
      numExercises: t.templateExercises.length,
      duracionEstimadaMin: t.duracionEstimadaMin,
    })),
    completedTemplateIds,
    semana: {
      cicloId: cycle.id,
      numeroSemana,
      iniciadaEn: cycle.iniciadaEn,
      // La semana está completa cuando cada plantilla del bloque se hizo una
      // vez. Es lo que dispara la celebración, y por eso exige que haya al
      // menos una plantilla: un bloque vacío no "completa" nada.
      completada: templateIds.length > 0 && completedTemplateIds.length >= templateIds.length,
      celebradaEn: cycle.celebradaEn,
    },
    sugeridaId: sessionTemplate.id,
    sessionTemplate: {
      id: sessionTemplate.id,
      clave: sessionTemplate.clave,
      nombre: sessionTemplate.nombre,
      duracionEstimadaMin: sessionTemplate.duracionEstimadaMin,
      numExercises: sessionTemplate.templateExercises.length,
    },
    exercises,
    metricasCorporales: {
      pesoKg: metricaActual?.pesoKg ?? null,
      grasaPct: metricaActual?.grasaPct ?? null,
      masaMuscularKg: metricaActual?.masaMuscularKg ?? null,
      actualizadoEn: metricaActual?.updatedAt.toISOString() ?? null,
      esDeHoy,
    },
  });
}
