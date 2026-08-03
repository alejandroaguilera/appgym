import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExportToken } from "@/lib/exportAuth";
import { computeWeekRange } from "@/lib/exportWeek";
import { sumVolumenKg } from "@/lib/logic/volumen";
import { calcObjetivoHoy } from "@/lib/logic/objetivo-hoy";
import { generarMarkdownSesion, generarMarkdownResumenSemanal } from "@/lib/logic/markdown";

const PR_LABEL: Record<string, string> = {
  PESO_MAX: "peso máximo",
  REPS_A_PESO: "reps a un peso",
  E1RM: "e1RM estimado",
  VOLUMEN: "volumen de sesión",
};

export async function GET(req: NextRequest) {
  const auth = await requireExportToken(req);
  if (typeof auth !== "string") return auth;
  const atletaId = auth;

  const tipo = req.nextUrl.searchParams.get("tipo");

  if (tipo === "log") {
    const sessionId = req.nextUrl.searchParams.get("sesion");
    if (!sessionId) return NextResponse.json({ error: "falta ?sesion=" }, { status: 400 });
    const markdown = await markdownDeSesion(atletaId, sessionId);
    if (!markdown) return NextResponse.json({ error: "sesión no encontrada" }, { status: 404 });
    return new NextResponse(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  }

  if (tipo === "semanal") {
    const markdown = await markdownResumenSemanal(atletaId, req.nextUrl.searchParams.get("semana"));
    return new NextResponse(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  }

  return NextResponse.json({ error: "usa ?tipo=log&sesion=<id> o ?tipo=semanal&semana=" }, { status: 400 });
}

async function markdownDeSesion(atletaId: string, sessionId: string): Promise<string | null> {
  const session = await prisma.sessionLog.findFirst({
    where: { id: sessionId, atletaId },
    include: {
      setLogs: {
        orderBy: [{ exerciseId: "asc" }, { numeroSerie: "asc" }],
        include: { exercise: { select: { id: true, nombre: true, incrementoMinimoKg: true } } },
      },
    },
  });
  if (!session) return null;

  const sessionTemplate = session.sessionTemplateId
    ? await prisma.sessionTemplate.findUnique({
        where: { id: session.sessionTemplateId },
        select: { id: true, clave: true, nombre: true },
      })
    : null;

  const porEjercicio = new Map<string, typeof session.setLogs>();
  for (const s of session.setLogs) {
    const arr = porEjercicio.get(s.exerciseId) ?? [];
    arr.push(s);
    porEjercicio.set(s.exerciseId, arr);
  }

  const ejercicios = await Promise.all(
    [...porEjercicio.entries()].map(async ([exerciseId, sets]) => {
      const setsTrabajo = sets.filter((s) => s.tipo === "TRABAJO");
      const siguienteTexto = await siguienteTextoParaEjercicio(
        sessionTemplate?.id ?? null,
        exerciseId,
        sets[0].exercise.incrementoMinimoKg,
        setsTrabajo
      );
      return {
        nombre: sets[0].exercise.nombre,
        sets: sets.map((s) => ({
          numeroSerie: s.numeroSerie,
          pesoKg: s.pesoKg,
          reps: s.reps,
          rir: s.rir,
          notas: s.notas,
          tipo: s.tipo,
        })),
        siguienteTexto,
      };
    })
  );

  const setLogIds = session.setLogs.map((s) => s.id);
  const prs = setLogIds.length
    ? await prisma.personalRecord.findMany({
        where: { setLogId: { in: setLogIds } },
        include: { exercise: { select: { nombre: true } } },
      })
    : [];
  const prsTexto =
    prs.length === 0
      ? "ninguno"
      : prs.map((pr) => `${pr.exercise.nombre} (${PR_LABEL[pr.tipo] ?? pr.tipo})`).join(", ");

  return generarMarkdownSesion({
    fecha: session.iniciadaEn.toISOString().slice(0, 10),
    clave: sessionTemplate?.clave ?? null,
    nombre: sessionTemplate?.nombre ?? "Libre",
    duracionMin: session.duracionActivaSeg ? Math.round(session.duracionActivaSeg / 60) : null,
    energia1a5: session.energia1a5,
    suenoHoras: session.suenoHorasPrevias,
    ejercicios,
    prsTexto,
  });
}

async function siguienteTextoParaEjercicio(
  sessionTemplateId: string | null,
  exerciseId: string,
  incrementoMinimoKg: number,
  setsTrabajo: { pesoKg: number; reps: number; rir: number | null }[]
): Promise<string> {
  if (!sessionTemplateId) return "— (sesión libre, sin objetivo)";
  const te = await prisma.templateExercise.findFirst({ where: { sessionTemplateId, exerciseId } });
  if (!te) return "— (ejercicio fuera de la plantilla actual)";
  const objetivo = calcObjetivoHoy({
    ultimaSesionSetsTrabajo: setsTrabajo,
    repsMin: te.repsMin,
    repsMax: te.repsMax,
    rirObjetivo: te.rirObjetivo,
    incrementoMinimoKg,
  });
  return objetivo.texto;
}

async function markdownResumenSemanal(atletaId: string, semanaParam: string | null): Promise<string> {
  const { desde, hasta } = computeWeekRange(semanaParam);

  const [sessions, block, metricInicio, metricFin, prs] = await Promise.all([
    prisma.sessionLog.findMany({
      where: { atletaId, estado: "COMPLETADA", archivadaEn: null, finalizadaEn: { gte: desde, lte: hasta } },
      include: { setLogs: { where: { tipo: { not: "CALENTAMIENTO" } }, select: { pesoKg: true, reps: true } } },
    }),
    prisma.block.findFirst({ where: { atletaId, estado: "ACTIVO" }, include: { sessionTemplates: { select: { id: true } } } }),
    prisma.bodyMetric.findFirst({ where: { atletaId, fecha: { lte: desde }, pesoKg: { not: null } }, orderBy: { fecha: "desc" } }),
    prisma.bodyMetric.findFirst({ where: { atletaId, fecha: { lte: hasta }, pesoKg: { not: null } }, orderBy: { fecha: "desc" } }),
    prisma.personalRecord.findMany({
      where: { atletaId, logradoEn: { gte: desde, lte: hasta } },
      include: { exercise: { select: { nombre: true } } },
    }),
  ]);

  const volumenTotalKg = sessions.reduce((sum, s) => sum + sumVolumenKg(s.setLogs), 0);
  const prsTexto = prs.length === 0 ? "ninguno" : prs.map((pr) => `${pr.exercise.nombre} (${PR_LABEL[pr.tipo] ?? pr.tipo})`).join(", ");

  return generarMarkdownResumenSemanal({
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
    sesionesCompletadas: sessions.length,
    sesionesProgramadas: block?.sessionTemplates.length ?? null,
    volumenTotalKg,
    pesoInicioSemana: metricInicio?.pesoKg ?? null,
    pesoFinSemana: metricFin?.pesoKg ?? null,
    prsTexto,
    banderasTexto: "— (detección de tendencia no construida todavía)",
  });
}
