import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireExportToken } from "@/lib/exportAuth";
import { computeWeekRange } from "@/lib/exportWeek";
import { localDayString, toDateOnlyUTC } from "@/lib/date";
import { sumVolumenKg } from "@/lib/logic/volumen";
import { calcObjetivoHoy } from "@/lib/logic/objetivo-hoy";
import { weekNumberForDate } from "@/lib/logic/next-session";
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

  // `sesiones` y `semanal` comparten el rango de semana; se resuelve una vez.
  if (tipo === "semanal" || tipo === "sesiones") {
    const semana = computeWeekRange(req.nextUrl.searchParams.get("semana"));
    if (!semana) {
      return NextResponse.json({ error: "?semana= inválido, usa YYYY-Www o YYYY-MM-DD" }, { status: 400 });
    }
    const markdown =
      tipo === "semanal"
        ? await markdownResumenSemanal(atletaId, semana.desde, semana.hasta)
        : await markdownSesionesDeSemana(atletaId, semana.desde, semana.hasta);
    return new NextResponse(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  }

  return NextResponse.json(
    { error: "usa ?tipo=log&sesion=<id>, ?tipo=sesiones&semana= o ?tipo=semanal&semana=" },
    { status: 400 }
  );
}

const SETLOGS_INCLUDE = Prisma.validator<Prisma.SessionLogInclude>()({
  setLogs: {
    orderBy: [{ exerciseId: "asc" }, { numeroSerie: "asc" }],
    include: { exercise: { select: { id: true, nombre: true, incrementoMinimoKg: true } } },
  },
});

type SesionCargada = Prisma.SessionLogGetPayload<{ include: typeof SETLOGS_INCLUDE }>;

async function markdownDeSesion(atletaId: string, sessionId: string): Promise<string | null> {
  const session = await prisma.sessionLog.findFirst({
    where: { id: sessionId, atletaId },
    include: SETLOGS_INCLUDE,
  });
  if (!session) return null;
  const [markdown] = await renderSesiones([session]);
  return markdown;
}

// Renderiza N sesiones ya cargadas en el formato "Log de sesión" del spec §7.2.
// Las consultas de apoyo (plantillas, ejercicios de plantilla, PRs) se hacen en
// lote sobre todas las sesiones: renderizar una semana completa no debe costar
// una consulta por ejercicio por sesión.
async function renderSesiones(sessions: SesionCargada[]): Promise<string[]> {
  if (sessions.length === 0) return [];

  const templateIds = [...new Set(sessions.map((s) => s.sessionTemplateId).filter((id): id is string => !!id))];
  const setLogIds = sessions.flatMap((s) => s.setLogs.map((set) => set.id));

  const [templates, templateExercises, prs] = await Promise.all([
    templateIds.length
      ? prisma.sessionTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, clave: true, nombre: true, block: { select: { nombre: true, fechaInicio: true } } },
        })
      : [],
    templateIds.length
      ? prisma.templateExercise.findMany({ where: { sessionTemplateId: { in: templateIds } } })
      : [],
    setLogIds.length
      ? prisma.personalRecord.findMany({
          where: { setLogId: { in: setLogIds } },
          include: { exercise: { select: { nombre: true } } },
        })
      : [],
  ]);

  const templatePorId = new Map(templates.map((t) => [t.id, t]));
  const templateExercisePorClave = new Map(templateExercises.map((te) => [`${te.sessionTemplateId}:${te.exerciseId}`, te]));
  const prsPorSetLog = new Map<string, typeof prs>();
  for (const pr of prs) {
    if (!pr.setLogId) continue;
    prsPorSetLog.set(pr.setLogId, [...(prsPorSetLog.get(pr.setLogId) ?? []), pr]);
  }

  return sessions.map((session) => {
    const template = session.sessionTemplateId ? templatePorId.get(session.sessionTemplateId) : undefined;

    const porEjercicio = new Map<string, typeof session.setLogs>();
    for (const s of session.setLogs) {
      porEjercicio.set(s.exerciseId, [...(porEjercicio.get(s.exerciseId) ?? []), s]);
    }

    const ejercicios = [...porEjercicio.entries()].map(([exerciseId, sets]) => ({
      nombre: sets[0].exercise.nombre,
      sets: sets.map((s) => ({
        numeroSerie: s.numeroSerie,
        pesoKg: s.pesoKg,
        reps: s.reps,
        rir: s.rir,
        notas: s.notas,
        tipo: s.tipo,
      })),
      siguienteTexto: siguienteTextoParaEjercicio(
        template ? templateExercisePorClave.get(`${template.id}:${exerciseId}`) : undefined,
        !template,
        sets[0].exercise.incrementoMinimoKg,
        sets.filter((s) => s.tipo === "TRABAJO")
      ),
    }));

    const prsDeSesion = session.setLogs.flatMap((s) => prsPorSetLog.get(s.id) ?? []);

    return generarMarkdownSesion({
      // Día calendario local: `toISOString()` sobre una sesión de la tarde en
      // México (UTC-6) devuelve el día siguiente.
      fecha: localDayString(session.iniciadaEn),
      clave: template?.clave ?? null,
      nombre: template?.nombre ?? "Libre",
      duracionMin: session.duracionActivaSeg ? Math.round(session.duracionActivaSeg / 60) : null,
      energia1a5: session.energia1a5,
      suenoHoras: session.suenoHorasPrevias,
      ejercicios,
      prsTexto:
        prsDeSesion.length === 0
          ? "ninguno"
          : prsDeSesion.map((pr) => `${pr.exercise.nombre} (${PR_LABEL[pr.tipo] ?? pr.tipo})`).join(", "),
      semanaNumero: template?.block ? weekNumberForDate(template.block.fechaInicio, session.iniciadaEn) : null,
      bloqueNombre: template?.block?.nombre ?? null,
      molestiaTexto: textoMolestia(session.setLogs),
    });
  });
}

// Una línea por zona con el nivel más alto reportado en la sesión. El spec
// habla de "molestia de hombro" porque es la restricción que gobierna el
// bloque 1, pero el modelo guarda la zona como texto libre — se derivan las
// que haya en vez de cablear una.
function textoMolestia(setLogs: { molestiaFlag: boolean; molestiaZona: string | null; molestiaNivel1a10: number | null }[]): string | null {
  const porZona = new Map<string, number | null>();
  for (const s of setLogs) {
    if (!s.molestiaFlag || !s.molestiaZona) continue;
    const previo = porZona.get(s.molestiaZona) ?? null;
    porZona.set(s.molestiaZona, Math.max(previo ?? 0, s.molestiaNivel1a10 ?? 0) || null);
  }
  if (porZona.size === 0) return null;
  return [...porZona.entries()].map(([zona, nivel]) => (nivel != null ? `${zona} ${nivel}/10` : zona)).join("; ");
}

function siguienteTextoParaEjercicio(
  te: { repsMin: number; repsMax: number | null; rirObjetivo: number | null } | undefined,
  esSesionLibre: boolean,
  incrementoMinimoKg: number,
  setsTrabajo: { pesoKg: number; reps: number; rir: number | null }[]
): string {
  if (esSesionLibre) return "— (sesión libre, sin objetivo)";
  if (!te) return "— (ejercicio fuera de la plantilla actual)";
  return calcObjetivoHoy({
    ultimaSesionSetsTrabajo: setsTrabajo,
    repsMin: te.repsMin,
    repsMax: te.repsMax,
    rirObjetivo: te.rirObjetivo,
    incrementoMinimoKg,
  }).texto;
}

async function markdownSesionesDeSemana(atletaId: string, desde: Date, hasta: Date): Promise<string> {
  const sessions = await prisma.sessionLog.findMany({
    where: { atletaId, estado: "COMPLETADA", archivadaEn: null, iniciadaEn: { gte: desde, lt: hasta } },
    orderBy: { iniciadaEn: "asc" },
    include: SETLOGS_INCLUDE,
  });

  const bloques = await renderSesiones(sessions);
  // Nunca un body vacío: el script del hub descarta la respuesta aunque el
  // HTTP sea 200 si el archivo queda en cero bytes.
  if (bloques.length === 0) return "Sin sesiones registradas esta semana.";
  return bloques.join("\n\n---\n\n");
}

async function markdownResumenSemanal(atletaId: string, desde: Date, hasta: Date): Promise<string> {
  const primerDia = toDateOnlyUTC(desde);
  const ultimoDia = new Date(toDateOnlyUTC(hasta).getTime() - 86_400_000); // domingo

  const [sessions, block, metricInicio, metricFin, prs] = await Promise.all([
    prisma.sessionLog.findMany({
      where: { atletaId, estado: "COMPLETADA", archivadaEn: null, iniciadaEn: { gte: desde, lt: hasta } },
      include: { setLogs: { where: { tipo: { not: "CALENTAMIENTO" } }, select: { pesoKg: true, reps: true } } },
    }),
    prisma.block.findFirst({ where: { atletaId, estado: "ACTIVO" }, include: { sessionTemplates: { select: { id: true } } } }),
    // BodyMetric.fecha es @db.Date — se compara en días calendario, no contra
    // los límites de la semana, que llevan el offset del huso incrustado.
    prisma.bodyMetric.findFirst({ where: { atletaId, fecha: { lte: primerDia }, pesoKg: { not: null } }, orderBy: { fecha: "desc" } }),
    prisma.bodyMetric.findFirst({ where: { atletaId, fecha: { lte: ultimoDia }, pesoKg: { not: null } }, orderBy: { fecha: "desc" } }),
    prisma.personalRecord.findMany({
      where: { atletaId, logradoEn: { gte: desde, lt: hasta } },
      include: { exercise: { select: { nombre: true } } },
    }),
  ]);

  const volumenTotalKg = sessions.reduce((sum, s) => sum + sumVolumenKg(s.setLogs), 0);
  const prsTexto = prs.length === 0 ? "ninguno" : prs.map((pr) => `${pr.exercise.nombre} (${PR_LABEL[pr.tipo] ?? pr.tipo})`).join(", ");

  return generarMarkdownResumenSemanal({
    desde: primerDia.toISOString().slice(0, 10),
    hasta: ultimoDia.toISOString().slice(0, 10),
    sesionesCompletadas: sessions.length,
    sesionesProgramadas: block?.sessionTemplates.length ?? null,
    volumenTotalKg,
    pesoInicioSemana: metricInicio?.pesoKg ?? null,
    pesoFinSemana: metricFin?.pesoKg ?? null,
    prsTexto,
    banderasTexto: "— (detección de tendencia no construida todavía)",
  });
}
