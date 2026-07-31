import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";
import { nextSessionTemplate, weekNumberForDate } from "@/lib/logic/next-session";
import { resolveWeekOverride, applyWeekOverride } from "@/lib/logic/week-resolve";
import { calcObjetivoHoy } from "@/lib/logic/objetivo-hoy";

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
  const numeroSemana = weekNumberForDate(block.fechaInicio, today);
  const override = resolveWeekOverride(block.weekOverrides, numeroSemana);

  let sessionTemplate = requestedTemplateId
    ? block.sessionTemplates.find((t) => t.id === requestedTemplateId)
    : undefined;

  if (!sessionTemplate) {
    const lastCompleted = await prisma.sessionLog.findFirst({
      where: { atletaId, estado: "COMPLETADA", sessionTemplateId: { not: null } },
      orderBy: { finalizadaEn: "desc" },
    });
    const next = nextSessionTemplate(
      block.sessionTemplates,
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

  const todayStr = today.toISOString().slice(0, 10);
  const pesoHoy = await prisma.bodyMetric.findUnique({
    where: { atletaId_fecha: { atletaId, fecha: new Date(todayStr) } },
    select: { pesoKg: true },
  });

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
    sugeridaId: sessionTemplate.id,
    sessionTemplate: {
      id: sessionTemplate.id,
      clave: sessionTemplate.clave,
      nombre: sessionTemplate.nombre,
      duracionEstimadaMin: sessionTemplate.duracionEstimadaMin,
      numExercises: sessionTemplate.templateExercises.length,
    },
    exercises,
    pesoHoyKg: pesoHoy?.pesoKg ?? null,
  });
}
