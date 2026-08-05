import { prisma } from "@/lib/prisma";
import { localDayString } from "@/lib/date";
import { SET_NO_CALENTAMIENTO, sumVolumenKg, computeVolumenPorGrupo, pickGrupoExtremo } from "@/lib/logic/volumen";

// Un solo objeto sirve a tres consumidores: el prompt de Grok, las tarjetas del
// overlay de cierre y el markdown que Alejandro copia para pasarle la semana al
// coach. Si se separaran, los tres podrían contar cosas distintas.
export interface WeekSummary {
  numeroSemana: number;
  bloqueNombre: string;
  sesionesCompletadas: number;
  sesionesPlaneadas: number;
  volumenTotalKg: number;
  seriesTotales: number;
  duracionTotalMin: number;
  energiaPromedio: number | null;
  deltaVolumenPct: number | null;
  grupoTop: { grupo: string; volumenKg: number } | null;
  volumenPorGrupo: { grupo: string; volumenKg: number }[];
  sesiones: {
    clave: string | null;
    nombre: string;
    fecha: string;
    volumenKg: number;
    series: number;
    duracionMin: number | null;
  }[];
  prs: { ejercicio: string; tipo: string; valor: number }[];
  molestias: { zona: string; nivelMax: number | null }[];
}

interface CycleLite {
  numeroSemana: number;
  iniciadaEn: Date;
  cerradaEn: Date | null;
}

const PR_LABEL: Record<string, string> = {
  PESO_MAX: "peso máximo",
  REPS_A_PESO: "reps a un peso",
  E1RM: "e1RM estimado",
  VOLUMEN: "volumen de sesión",
};

// Todo lo del ciclo se mide contra [iniciadaEn, cerradaEn ?? ahora): la misma
// ventana que decide qué sesiones cuentan como completadas en /api/today, para
// que la felicitación no pueda celebrar algo que la pantalla no marcó.
function ventana(cycle: CycleLite) {
  return { gte: cycle.iniciadaEn, ...(cycle.cerradaEn ? { lt: cycle.cerradaEn } : {}) };
}

export async function buildWeekSummary(
  atletaId: string,
  block: { id: string; nombre: string },
  cycle: CycleLite,
  cicloAnterior: CycleLite | null
): Promise<WeekSummary> {
  // Las plantillas del bloque acotan qué cuenta como sesión de esta semana:
  // una sesión de un bloque anterior no debe sumar volumen ni sesiones al
  // resumen que se le presenta al atleta como "tu semana".
  const templatesDelBloque = await prisma.sessionTemplate.findMany({
    where: { blockId: block.id },
    select: { id: true, clave: true, nombre: true },
  });
  const templateIds = templatesDelBloque.map((t) => t.id);

  const [sessions, prs] = await Promise.all([
    prisma.sessionLog.findMany({
      where: {
        atletaId,
        estado: "COMPLETADA",
        sessionTemplateId: { in: templateIds },
        finalizadaEn: ventana(cycle),
        setLogs: { some: SET_NO_CALENTAMIENTO },
      },
      orderBy: { finalizadaEn: "asc" },
      include: {
        setLogs: {
          where: SET_NO_CALENTAMIENTO,
          select: {
            pesoKg: true,
            reps: true,
            molestiaFlag: true,
            molestiaZona: true,
            molestiaNivel1a10: true,
            exercise: { select: { grupoMuscularPrimario: true } },
          },
        },
      },
    }),
    prisma.personalRecord.findMany({
      where: { atletaId, logradoEn: ventana(cycle) },
      orderBy: { logradoEn: "asc" },
      include: { exercise: { select: { nombre: true } } },
    }),
  ]);

  const templatePorId = new Map(templatesDelBloque.map((t) => [t.id, t]));
  const todosLosSets = sessions.flatMap((s) => s.setLogs);

  const volumenPorGrupo = computeVolumenPorGrupo(todosLosSets);
  const volumenTotalKg = sumVolumenKg(todosLosSets);

  // Volumen del ciclo anterior para el delta. Sin ciclo previo (semana 1) el
  // delta es null, no 0: "no hay con qué comparar" y "no cambió" son cosas
  // distintas y el mensaje motivador no debe confundirlas.
  let deltaVolumenPct: number | null = null;
  if (cicloAnterior) {
    const previas = await prisma.sessionLog.findMany({
      where: {
        atletaId,
        estado: "COMPLETADA",
        sessionTemplateId: { in: templateIds },
        finalizadaEn: ventana(cicloAnterior),
        setLogs: { some: SET_NO_CALENTAMIENTO },
      },
      select: { setLogs: { where: SET_NO_CALENTAMIENTO, select: { pesoKg: true, reps: true } } },
    });
    const volumenPrevio = sumVolumenKg(previas.flatMap((s) => s.setLogs));
    if (volumenPrevio > 0) {
      deltaVolumenPct = Math.round(((volumenTotalKg - volumenPrevio) / volumenPrevio) * 100);
    }
  }

  const energias = sessions.map((s) => s.energia1a5).filter((e): e is number => e != null);

  const molestiasPorZona = new Map<string, number | null>();
  for (const s of todosLosSets) {
    if (!s.molestiaFlag || !s.molestiaZona) continue;
    const previo = molestiasPorZona.get(s.molestiaZona) ?? null;
    molestiasPorZona.set(s.molestiaZona, Math.max(previo ?? 0, s.molestiaNivel1a10 ?? 0) || null);
  }

  return {
    numeroSemana: cycle.numeroSemana,
    bloqueNombre: block.nombre,
    sesionesCompletadas: sessions.length,
    sesionesPlaneadas: templateIds.length,
    volumenTotalKg: Math.round(volumenTotalKg),
    seriesTotales: todosLosSets.length,
    duracionTotalMin: Math.round(
      sessions.reduce((sum, s) => sum + (s.duracionActivaSeg ?? 0), 0) / 60
    ),
    energiaPromedio: energias.length
      ? Math.round((energias.reduce((a, b) => a + b, 0) / energias.length) * 10) / 10
      : null,
    deltaVolumenPct,
    grupoTop: pickGrupoExtremo(volumenPorGrupo, "max"),
    volumenPorGrupo: [...volumenPorGrupo.entries()]
      .map(([grupo, volumenKg]) => ({ grupo, volumenKg: Math.round(volumenKg) }))
      .sort((a, b) => b.volumenKg - a.volumenKg),
    sesiones: sessions.map((s) => {
      const t = s.sessionTemplateId ? templatePorId.get(s.sessionTemplateId) : undefined;
      return {
        clave: t?.clave ?? null,
        nombre: t?.nombre ?? "Libre",
        fecha: localDayString(s.finalizadaEn ?? s.iniciadaEn),
        volumenKg: Math.round(sumVolumenKg(s.setLogs)),
        series: s.setLogs.length,
        duracionMin: s.duracionActivaSeg ? Math.round(s.duracionActivaSeg / 60) : null,
      };
    }),
    prs: prs.map((pr) => ({
      ejercicio: pr.exercise.nombre,
      tipo: PR_LABEL[pr.tipo] ?? pr.tipo,
      valor: pr.valor,
    })),
    molestias: [...molestiasPorZona.entries()].map(([zona, nivelMax]) => ({ zona, nivelMax })),
  };
}

// Mensaje determinista para cuando no hay API key o Grok no responde. La
// celebración nunca puede depender de que conteste un servicio externo.
export function mensajeFallback(r: WeekSummary): string {
  const logro = r.grupoTop
    ? ` Te luciste en ${r.grupoTop.grupo}`
    : r.prs.length
      ? ` Y te llevaste ${r.prs.length} récord${r.prs.length === 1 ? "" : "s"} personal${r.prs.length === 1 ? "" : "es"}`
      : " Semana sólida de principio a fin";
  return `¡Semana ${r.numeroSemana} completa! ${r.sesionesCompletadas} de ${r.sesionesPlaneadas} sesiones y ${r.volumenTotalKg.toLocaleString("es-MX")} kg de volumen.${logro}.`;
}

// El resumen que Alejandro copia del overlay para pasárselo al coach y que se
// carguen los ajustes de la semana siguiente antes de que arranque.
export function resumenMarkdown(r: WeekSummary): string {
  const lineas = [
    `# Semana ${r.numeroSemana} — ${r.bloqueNombre}`,
    "",
    `- Sesiones: ${r.sesionesCompletadas}/${r.sesionesPlaneadas}`,
    `- Volumen total: ${r.volumenTotalKg.toLocaleString("es-MX")} kg${r.deltaVolumenPct != null ? ` (${r.deltaVolumenPct >= 0 ? "+" : ""}${r.deltaVolumenPct}% vs. semana anterior)` : ""}`,
    `- Series de trabajo: ${r.seriesTotales}`,
    `- Tiempo activo: ${r.duracionTotalMin} min`,
    `- Energía promedio: ${r.energiaPromedio != null ? `${r.energiaPromedio}/5` : "sin registrar"}`,
    "",
    "## Sesiones",
    "",
    "| Sesión | Fecha | Series | Volumen | Duración |",
    "|---|---|---|---|---|",
    ...r.sesiones.map(
      (s) =>
        `| ${s.clave ? `${s.clave} · ` : ""}${s.nombre} | ${s.fecha} | ${s.series} | ${s.volumenKg.toLocaleString("es-MX")} kg | ${s.duracionMin != null ? `${s.duracionMin} min` : "—"} |`
    ),
    "",
    "## Volumen por grupo muscular",
    "",
    ...r.volumenPorGrupo.map((g) => `- ${g.grupo}: ${g.volumenKg.toLocaleString("es-MX")} kg`),
    "",
    "## Récords personales",
    "",
    ...(r.prs.length
      ? r.prs.map((pr) => `- ${pr.ejercicio} — ${pr.tipo}: ${pr.valor}`)
      : ["- ninguno esta semana"]),
    "",
    "## Molestias",
    "",
    ...(r.molestias.length
      ? r.molestias.map((m) => `- ${m.zona}${m.nivelMax != null ? ` ${m.nivelMax}/10` : ""}`)
      : ["- ninguna registrada"]),
  ];
  return lineas.join("\n");
}
