import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExportToken } from "@/lib/exportAuth";
import { toDateOnlyUTC } from "@/lib/date";
import { computeWeekRange } from "@/lib/exportWeek";
import { sumVolumenKg, computeVolumenPorGrupo } from "@/lib/logic/volumen";

// El endpoint "más importante" del spec §7.1 — debe alcanzar para un
// check-in semanal sin más peticiones. "Banderas activas" completas
// (§6.3: estancamiento, regresión) no están construidas en ningún lado de
// la app todavía — solo se calcula molestia recurrente aquí, el resto se
// deja como lista vacía, no simulado.
export async function GET(req: NextRequest) {
  const auth = await requireExportToken(req);
  if (typeof auth !== "string") return auth;
  const atletaId = auth;

  const semana = computeWeekRange(req.nextUrl.searchParams.get("semana"));
  if (!semana) {
    return NextResponse.json({ error: "?semana= inválido, usa YYYY-Www o YYYY-MM-DD" }, { status: 400 });
  }
  const { desde, hasta } = semana;

  const [sessions, prs, block] = await Promise.all([
    prisma.sessionLog.findMany({
      where: {
        atletaId,
        estado: "COMPLETADA",
        archivadaEn: null,
        iniciadaEn: { gte: desde, lt: hasta },
      },
      orderBy: { iniciadaEn: "asc" },
      include: {
        setLogs: {
          orderBy: [{ exerciseId: "asc" }, { numeroSerie: "asc" }],
          include: { exercise: { select: { nombre: true, grupoMuscularPrimario: true } } },
        },
      },
    }),
    prisma.personalRecord.findMany({
      where: { atletaId, logradoEn: { gte: desde, lt: hasta } },
      include: { exercise: { select: { nombre: true } } },
    }),
    prisma.block.findFirst({
      where: { atletaId, estado: "ACTIVO" },
      include: { sessionTemplates: { select: { id: true } } },
    }),
  ]);

  const setsNoCalentamiento = sessions.flatMap((s) => s.setLogs.filter((set) => set.tipo !== "CALENTAMIENTO"));
  const volumenPorGrupoMap = computeVolumenPorGrupo(setsNoCalentamiento);
  const volumenPorGrupoMuscular = Object.fromEntries(volumenPorGrupoMap);

  const molestiasReportadas = sessions.flatMap((s) =>
    s.setLogs
      .filter((set) => set.molestiaFlag)
      .map((set) => ({
        fecha: set.completadaEn.toISOString(),
        ejercicio: set.exercise.nombre,
        zona: set.molestiaZona,
        nivel: set.molestiaNivel1a10,
        nota: set.notas,
      }))
  );

  const banderasActivas = await detectarMolestiaRecurrente(atletaId, hasta);
  const metricasCorporales = await metricasConPromedioMovil(atletaId, desde, hasta);

  return NextResponse.json({
    version: 1,
    // `hasta` es exclusivo internamente (lunes siguiente 00:00 local); se
    // reporta el último instante incluido, que es lo que el consumidor espera.
    semana: { desde: desde.toISOString(), hasta: new Date(hasta.getTime() - 1).toISOString() },
    sesiones: sessions.map((s) => ({
      id: s.id,
      iniciadaEn: s.iniciadaEn.toISOString(),
      finalizadaEn: s.finalizadaEn?.toISOString() ?? null,
      duracionActivaSeg: s.duracionActivaSeg,
      energia1a5: s.energia1a5,
      suenoHorasPrevias: s.suenoHorasPrevias,
      notas: s.notas,
      volumenKg: sumVolumenKg(s.setLogs.filter((set) => set.tipo !== "CALENTAMIENTO")),
      series: s.setLogs.map((set) => ({
        ejercicio: set.exercise.nombre,
        grupoMuscularPrimario: set.exercise.grupoMuscularPrimario,
        numeroSerie: set.numeroSerie,
        pesoKg: set.pesoKg,
        reps: set.reps,
        rir: set.rir,
        tipo: set.tipo,
        esPr: set.esPr,
      })),
    })),
    prs: prs.map((pr) => ({
      ejercicio: pr.exercise.nombre,
      tipo: pr.tipo,
      valor: pr.valor,
      pesoKg: pr.pesoKg,
      reps: pr.reps,
      logradoEn: pr.logradoEn.toISOString(),
      estimacionBajaConfianza: pr.estimacionBajaConfianza,
    })),
    // "programadas" es una aproximación (número de sesiones A/B/C/D del
    // bloque activo) — no hay ScheduledSession poblado en esta versión.
    adherencia: { completadas: sessions.length, programadas: block?.sessionTemplates.length ?? null },
    volumenPorGrupoMuscular,
    banderasActivas,
    metricasCorporales,
    molestiasReportadas,
  });
}

async function detectarMolestiaRecurrente(atletaId: string, hasta: Date) {
  const desde14 = new Date(hasta.getTime() - 14 * 86_400_000);
  const sets = await prisma.setLog.findMany({
    where: {
      molestiaFlag: true,
      molestiaZona: { not: null },
      sessionLog: { atletaId },
      completadaEn: { gte: desde14, lt: hasta },
    },
    select: { molestiaZona: true },
  });

  const porZona = new Map<string, number>();
  for (const s of sets) {
    if (!s.molestiaZona) continue;
    porZona.set(s.molestiaZona, (porZona.get(s.molestiaZona) ?? 0) + 1);
  }

  return [...porZona.entries()]
    .filter(([, count]) => count >= 2)
    .map(([zona, ocurrencias]) => ({ tipo: "molestia_recurrente", zona, ocurrencias, ventanaDias: 14 }));
}

async function metricasConPromedioMovil(atletaId: string, desde: Date, hasta: Date) {
  // BodyMetric.fecha es @db.Date: se compara en el dominio de días calendario
  // (medianoche UTC), no contra los límites de la semana, que llevan el offset
  // del huso incrustado.
  const desdeDia = toDateOnlyUTC(new Date(desde.getTime() - 6 * 86_400_000));
  const primerDia = toDateOnlyUTC(desde);
  const finDia = toDateOnlyUTC(hasta); // exclusivo: lunes siguiente

  const metrics = await prisma.bodyMetric.findMany({
    where: { atletaId, fecha: { gte: desdeDia, lt: finDia } },
    orderBy: { fecha: "asc" },
    select: { fecha: true, pesoKg: true, grasaPct: true, masaMuscularKg: true },
  });

  const porFecha = new Map(metrics.map((m) => [m.fecha.toISOString().slice(0, 10), m]));
  const resultado: {
    fecha: string;
    pesoKg: number | null;
    pesoPromedioMovil7d: number | null;
    grasaPct: number | null;
    masaMuscularKg: number | null;
  }[] = [];

  for (let cursor = primerDia; cursor < finDia; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const key = cursor.toISOString().slice(0, 10);
    const actual = porFecha.get(key);

    const ventana: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor.getTime() - i * 86_400_000).toISOString().slice(0, 10);
      const pesoKg = porFecha.get(d)?.pesoKg;
      if (pesoKg != null) ventana.push(pesoKg);
    }
    const pesoPromedioMovil7d = ventana.length ? Math.round((ventana.reduce((a, b) => a + b, 0) / ventana.length) * 10) / 10 : null;

    resultado.push({
      fecha: key,
      pesoKg: actual?.pesoKg ?? null,
      pesoPromedioMovil7d,
      grasaPct: actual?.grasaPct ?? null,
      masaMuscularKg: actual?.masaMuscularKg ?? null,
    });
  }

  return resultado;
}
