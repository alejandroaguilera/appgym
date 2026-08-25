import { prisma } from "@/lib/prisma";
import { localDayString, dateOnlyString, APP_TIME_ZONE } from "@/lib/date";
import { SET_NO_CALENTAMIENTO } from "@/lib/logic/volumen";
import { buildWeekSummary } from "@/lib/logic/week-summary";
import { kgALb } from "@/lib/mcp/units";

const DIA_MS = 86_400_000;

function diasEntre(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DIA_MS);
}

// SPEC §5.1. Primera llamada de toda conversación: si el coach tiene que
// preguntarle a Alejandro en qué semana va, el sistema falló.
//
// Divergencias respecto del spec, todas por "gana el repo" (§8):
//  - La semana se identifica por `numero_semana` dentro del bloque, no por
//    semana ISO. En este repo una semana es un WeekCycle (un ciclo de
//    progreso que dura hasta completar cada plantilla una vez), no una
//    ventana de siete días — ver el comentario del modelo WeekCycle.
//  - "Bloque vigente" es `estado: ACTIVO`, no el bloque cuyo rango de fechas
//    contiene a hoy. El campo existe y es el que usa /api/today.
export async function estado(atletaId: string) {
  const ahora = new Date();
  const hoy = localDayString(ahora);

  const block = await prisma.block.findFirst({
    where: { atletaId, estado: "ACTIVO" },
    include: {
      sessionTemplates: { orderBy: { orden: "asc" }, select: { id: true, clave: true, nombre: true } },
      weekOverrides: true,
    },
  });

  const [ultimaSesion, sesionAbierta, ultimaMetrica, prsRecientes] = await Promise.all([
    prisma.sessionLog.findFirst({
      where: { atletaId, estado: "COMPLETADA", archivadaEn: null, setLogs: { some: SET_NO_CALENTAMIENTO } },
      orderBy: { iniciadaEn: "desc" },
      include: { _count: { select: { setLogs: true } } },
    }),
    prisma.sessionLog.findFirst({
      where: { atletaId, estado: "EN_PROGRESO", archivadaEn: null },
      orderBy: { iniciadaEn: "desc" },
    }),
    prisma.bodyMetric.findFirst({ where: { atletaId }, orderBy: { fecha: "desc" } }),
    prisma.personalRecord.findMany({
      where: { atletaId, logradoEn: { gte: new Date(ahora.getTime() - 30 * DIA_MS) } },
      orderBy: { logradoEn: "desc" },
      include: { exercise: { select: { nombre: true } } },
    }),
  ]);

  const alertas: string[] = [];

  // Una sesión abierta sin cerrar de hace más de un día es casi siempre un
  // ejecutor que quedó a medias, y sus series no cuentan en ningún resumen.
  if (sesionAbierta && diasEntre(sesionAbierta.iniciadaEn, ahora) >= 1) {
    alertas.push(
      `Hay una sesión sin cerrar iniciada el ${localDayString(sesionAbierta.iniciadaEn)}. Sus series no cuentan en ningún resumen hasta que se cierre en la app.`
    );
  }
  if (ultimaSesion) {
    const dias = diasEntre(ultimaSesion.iniciadaEn, ahora);
    if (dias >= 5) alertas.push(`Van ${dias} días sin una sesión registrada.`);
  } else {
    alertas.push("No hay ninguna sesión con series registradas todavía.");
  }
  if (ultimaMetrica) {
    const dias = diasEntre(ultimaMetrica.fecha, ahora);
    if (dias > 14) alertas.push(`La última métrica corporal es de hace ${dias} días.`);
  } else {
    alertas.push("No hay ninguna métrica corporal registrada.");
  }

  const base = {
    hoy,
    zona_horaria: APP_TIME_ZONE,
    // El coach necesita saber que "semana" aquí no es calendario, o va a
    // prescribir contra un modelo mental equivocado.
    modelo_de_semana:
      "Una semana es un ciclo de progreso (WeekCycle), no siete días: la semana N dura hasta que cada plantilla del bloque se completó una vez. Se identifica por numero_semana dentro del bloque.",
    regla_sesion_completada:
      "Una sesión cuenta solo si está COMPLETADA y tiene al menos una serie que no sea de calentamiento. Es la misma regla que usa la app en /api/today.",
  };

  if (!block) {
    return {
      ...base,
      bloque_vigente: null,
      alertas: [
        ...alertas,
        "No hay ningún bloque con estado ACTIVO. Usa crear_bloque para abrir uno antes de prescribir.",
      ],
    };
  }

  const templateIds = block.sessionTemplates.map((t) => t.id);

  const ciclos = await prisma.weekCycle.findMany({
    where: { blockId: block.id },
    orderBy: { numeroSemana: "asc" },
  });
  const cicloAbierto = ciclos.find((c) => c.cerradaEn === null) ?? null;
  const cerrados = ciclos.filter((c) => c.cerradaEn !== null);
  const ultimoCerrado = cerrados.length > 0 ? cerrados[cerrados.length - 1] : null;

  // Se reusa buildWeekSummary a propósito (SPEC: "no reimplementar"): es la
  // misma cuenta que alimenta el overlay de celebración y el markdown que
  // Alejandro copiaba a mano. Si el MCP contara distinto, el coach y la app
  // le dirían dos cosas diferentes sobre la misma semana.
  const anterior = (n: number) => ciclos.find((c) => c.numeroSemana === n - 1) ?? null;

  const resumenAbierto = cicloAbierto
    ? await buildWeekSummary(atletaId, block, cicloAbierto, anterior(cicloAbierto.numeroSemana))
    : null;
  const resumenCerrado = ultimoCerrado
    ? await buildWeekSummary(atletaId, block, ultimoCerrado, anterior(ultimoCerrado.numeroSemana))
    : null;

  const tieneAjuste = (n: number) => block.weekOverrides.some((o) => o.numeroSemana === n);

  // La semana a prescribir es la primera sobre la que todavía no se entrenó:
  // el ciclo abierto si aún está en blanco, o el siguiente si ya arrancó. Es
  // el mismo criterio que la guarda de ajustar_semana ("solo semanas sin
  // entrenar"), para que estado nunca apunte a una semana que la escritura
  // vaya a rechazar con 409.
  const numeroAbierto = cicloAbierto?.numeroSemana ?? (ultimoCerrado ? ultimoCerrado.numeroSemana + 1 : 1);
  const sesionesEnAbierto = resumenAbierto?.sesionesCompletadas ?? 0;
  const numeroAPrescribir = sesionesEnAbierto > 0 ? numeroAbierto + 1 : numeroAbierto;

  if (!tieneAjuste(numeroAPrescribir)) {
    alertas.push(`La semana ${numeroAPrescribir} todavía no tiene ajuste prescrito.`);
  }
  if (block.fechaFin < new Date(`${hoy}T00:00:00.000Z`)) {
    alertas.push(
      `El bloque "${block.nombre}" terminó el ${dateOnlyString(block.fechaFin)} y sigue ACTIVO. Considera cerrarlo con crear_bloque.`
    );
  }

  // Adherencia sobre las semanas ya transcurridas: cada ciclo planeó una
  // pasada de todas las plantillas del bloque.
  const semanasTranscurridas = cerrados.length + (sesionesEnAbierto > 0 ? 1 : 0);
  const completadasTotal = await prisma.sessionLog.count({
    where: {
      atletaId,
      estado: "COMPLETADA",
      archivadaEn: null,
      sessionTemplateId: { in: templateIds },
      setLogs: { some: SET_NO_CALENTAMIENTO },
    },
  });
  const planeadasTotal = templateIds.length * Math.max(semanasTranscurridas, 1);

  return {
    ...base,
    bloque_vigente: {
      id: block.id,
      nombre: block.nombre,
      estado: block.estado,
      fecha_inicio: dateOnlyString(block.fechaInicio),
      fecha_fin: dateOnlyString(block.fechaFin),
      plantillas: block.sessionTemplates.map((t) => ({ id: t.id, letra: t.clave, nombre: t.nombre })),
      semanas_transcurridas: semanasTranscurridas,
    },
    semana_en_curso: cicloAbierto
      ? {
          numero: cicloAbierto.numeroSemana,
          iniciada_en: cicloAbierto.iniciadaEn.toISOString(),
          completadas: sesionesEnAbierto,
          planeadas: templateIds.length,
          completa: templateIds.length > 0 && sesionesEnAbierto >= templateIds.length,
          celebrada_en: cicloAbierto.celebradaEn?.toISOString() ?? null,
          tiene_ajuste: tieneAjuste(cicloAbierto.numeroSemana),
        }
      : null,
    semana_que_cerro: ultimoCerrado
      ? {
          numero: ultimoCerrado.numeroSemana,
          iniciada_en: ultimoCerrado.iniciadaEn.toISOString(),
          cerrada_en: ultimoCerrado.cerradaEn!.toISOString(),
          completadas: resumenCerrado?.sesionesCompletadas ?? 0,
          planeadas: resumenCerrado?.sesionesPlaneadas ?? templateIds.length,
          volumen_total_kg: resumenCerrado?.volumenTotalKg ?? 0,
          delta_volumen_pct: resumenCerrado?.deltaVolumenPct ?? null,
          tuvo_ajuste: tieneAjuste(ultimoCerrado.numeroSemana),
        }
      : null,
    semana_a_prescribir: {
      numero: numeroAPrescribir,
      ya_tiene_ajuste: tieneAjuste(numeroAPrescribir),
      sesiones_ya_registradas: numeroAPrescribir === numeroAbierto ? sesionesEnAbierto : 0,
    },
    ultima_sesion: ultimaSesion
      ? {
          id: ultimaSesion.id,
          fecha: localDayString(ultimaSesion.iniciadaEn),
          hace_dias: diasEntre(ultimaSesion.iniciadaEn, ahora),
          series_registradas: ultimaSesion._count.setLogs,
        }
      : null,
    bloque_acumulado: {
      planeadas: planeadasTotal,
      completadas: completadasTotal,
      adherencia: planeadasTotal > 0 ? Math.round((completadasTotal / planeadasTotal) * 100) / 100 : null,
    },
    peso_corporal: ultimaMetrica
      ? {
          fecha: dateOnlyString(ultimaMetrica.fecha),
          hace_dias: diasEntre(ultimaMetrica.fecha, ahora),
          peso_kg: ultimaMetrica.pesoKg,
          grasa_pct: ultimaMetrica.grasaPct,
          masa_muscular_kg: ultimaMetrica.masaMuscularKg,
        }
      : null,
    prs_recientes: prsRecientes.map((pr) => ({
      ejercicio: pr.exercise.nombre,
      tipo: pr.tipo,
      valor: pr.tipo === "REPS_A_PESO" ? pr.valor : kgALb(pr.valor),
      unidad: pr.tipo === "REPS_A_PESO" ? "reps" : "lb",
      peso_lb: pr.pesoKg != null ? kgALb(pr.pesoKg) : null,
      reps: pr.reps,
      fecha: localDayString(pr.logradoEn),
    })),
    alertas,
  };
}
