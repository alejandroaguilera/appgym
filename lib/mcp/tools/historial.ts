import { prisma } from "@/lib/prisma";
import { localDayString, dateOnlyString, localDateRangeBounds } from "@/lib/date";
import { sumVolumenKg } from "@/lib/logic/volumen";
import { resolveCycleForDate } from "@/lib/logic/week-cycle";
import { kgALb } from "@/lib/mcp/units";

// Techo de sesiones por respuesta. No es un límite de la base sino de lo que
// cabe razonablemente en una respuesta de herramienta; al alcanzarlo se dice
// explícitamente (SPEC §5.2: "nunca truncar en silencio").
const MAX_SESIONES = 120;

// SPEC §5.2. Prescripción y ejecución en una sola llamada, en crudo: los
// cortes por semana, ejercicio, tonelaje o volumen los hace el coach.
export async function historial(
  atletaId: string,
  args: { desde: string; hasta: string; incluir_series?: boolean }
) {
  const incluirSeries = args.incluir_series ?? true;

  // El rango se aplica sobre `iniciadaEn`, NO sobre `finalizadaEn` (SPEC §3).
  // `finalizadaEn` es nullable: una sesión real que llegó por sendBeacon puede
  // no tenerlo, y filtrar por ahí la deja fuera sin ninguna señal de error.
  // Es el bug exacto que tuvo /api/v1/export/sessions.
  const rango = localDateRangeBounds(args.desde, args.hasta);
  if (!rango.gte || !rango.lt) {
    throw new Error(
      `Rango de fechas inválido: desde="${args.desde}" hasta="${args.hasta}". Usa el formato YYYY-MM-DD.`
    );
  }

  const [sesiones, totalSesiones, prs, metricas, bloques] = await Promise.all([
    prisma.sessionLog.findMany({
      where: { atletaId, archivadaEn: null, iniciadaEn: rango },
      orderBy: { iniciadaEn: "asc" },
      take: MAX_SESIONES,
      include: {
        setLogs: {
          orderBy: [{ exerciseId: "asc" }, { numeroSerie: "asc" }],
          include: { exercise: { select: { nombre: true, grupoMuscularPrimario: true } } },
        },
      },
    }),
    prisma.sessionLog.count({ where: { atletaId, archivadaEn: null, iniciadaEn: rango } }),
    prisma.personalRecord.findMany({
      where: { atletaId, logradoEn: rango },
      orderBy: { logradoEn: "asc" },
      include: { exercise: { select: { nombre: true } } },
    }),
    prisma.bodyMetric.findMany({
      where: { atletaId, fecha: { gte: new Date(`${args.desde}T00:00:00.000Z`), lte: new Date(`${args.hasta}T00:00:00.000Z`) } },
      orderBy: { fecha: "asc" },
    }),
    // Los bloques que se solapan con el rango: su prescripción es el "contra
    // qué" de todo lo ejecutado. Sin esto el coach ve reps y pesos sin saber
    // qué se había pedido.
    prisma.block.findMany({
      where: { atletaId, fechaInicio: { lte: rango.lt }, fechaFin: { gte: rango.gte } },
      orderBy: { fechaInicio: "asc" },
      include: {
        sessionTemplates: {
          orderBy: { orden: "asc" },
          include: {
            templateExercises: {
              orderBy: { orden: "asc" },
              include: { exercise: { select: { nombre: true, incrementoMinimoKg: true } } },
            },
          },
        },
        weekOverrides: { orderBy: { numeroSemana: "asc" } },
        weekCycles: { orderBy: { numeroSemana: "asc" } },
      },
    }),
  ]);

  // Etiquetar cada sesión con la semana que el atleta realmente vio cuando la
  // entrenó. Calcularla por calendario daría otro número.
  const todosLosCiclos = bloques.flatMap((b) => b.weekCycles);
  const templateABloque = new Map<string, string>();
  for (const b of bloques) for (const t of b.sessionTemplates) templateABloque.set(t.id, b.id);

  return {
    rango: { desde: args.desde, hasta: args.hasta, filtrado_por: "iniciadaEn" },
    truncado: totalSesiones > sesiones.length,
    ...(totalSesiones > sesiones.length
      ? {
          nota_truncado: `Hay ${totalSesiones} sesiones en el rango y se devolvieron las primeras ${sesiones.length}. Acota el rango con desde/hasta para ver el resto.`,
        }
      : {}),

    bloques: bloques.map((b) => ({
      id: b.id,
      nombre: b.nombre,
      estado: b.estado,
      fecha_inicio: dateOnlyString(b.fechaInicio),
      fecha_fin: dateOnlyString(b.fechaFin),
      notas: b.notas,
      semanas: b.weekCycles.map((c) => ({
        numero: c.numeroSemana,
        iniciada_en: c.iniciadaEn.toISOString(),
        cerrada_en: c.cerradaEn?.toISOString() ?? null,
      })),
      // Los ajustes semanales aplicados: qué prescribió el coach antes y con
      // qué resultado (SPEC §5.2).
      ajustes_semanales: b.weekOverrides.map((o) => ({
        numero_semana: o.numeroSemana,
        delta_series: o.deltaSeries,
        rir_objetivo: o.rirObjetivo,
        nota: o.nota,
      })),
      plantillas: b.sessionTemplates.map((t) => ({
        id: t.id,
        letra: t.clave,
        nombre: t.nombre,
        notas: t.notas,
        ejercicios: t.templateExercises.map((te) => ({
          template_exercise_id: te.id,
          ejercicio_id: te.exerciseId,
          nombre: te.exercise.nombre,
          orden: te.orden,
          series: te.seriesObjetivo,
          reps_min: te.repsMin,
          reps_max: te.repsMax,
          unidad_reps: te.unidadReps,
          rir_objetivo: te.rirObjetivo,
          descanso_seg: te.descansoSeg,
          incremento_minimo_lb: kgALb(te.exercise.incrementoMinimoKg),
          es_opcional: te.esOpcional,
          // La prescripción de carga NO se guarda: la app la calcula por
          // doble progresión a partir de la última sesión. Esta nota es hoy
          // el único texto de prescripción por ejercicio que existe.
          nota: te.notas,
        })),
      })),
    })),

    // Las sesiones sin series SÍ se devuelven aquí, a diferencia de `estado`,
    // que las excluye de todo conteo: el coach ve el dato crudo y distingue
    // solo entre un entrenamiento y un ejecutor que se abrió por error.
    sesiones: sesiones.map((s) => {
      const trabajo = s.setLogs.filter((x) => x.tipo !== "CALENTAMIENTO");
      const blockId = s.sessionTemplateId ? templateABloque.get(s.sessionTemplateId) : undefined;
      const ciclo = resolveCycleForDate(
        todosLosCiclos.filter((c) => !blockId || c.blockId === blockId),
        s.iniciadaEn
      );
      return {
        id: s.id,
        fecha: localDayString(s.iniciadaEn),
        iniciada_en: s.iniciadaEn.toISOString(),
        finalizada_en: s.finalizadaEn?.toISOString() ?? null,
        estado: s.estado,
        numero_semana: ciclo?.numeroSemana ?? null,
        session_template_id: s.sessionTemplateId,
        duracion_activa_min: s.duracionActivaSeg ? Math.round(s.duracionActivaSeg / 60) : null,
        energia_1a5: s.energia1a5,
        sueno_horas_previas: s.suenoHorasPrevias,
        peso_corporal_kg: s.pesoCorporalKg,
        notas: s.notas,
        series_de_trabajo: trabajo.length,
        volumen_lb: Math.round(kgALb(sumVolumenKg(trabajo))),
        ...(incluirSeries
          ? {
              series: s.setLogs.map((set) => ({
                ejercicio: set.exercise.nombre,
                ejercicio_id: set.exerciseId,
                grupo_muscular: set.exercise.grupoMuscularPrimario,
                numero_serie: set.numeroSerie,
                peso_lb: kgALb(set.pesoKg),
                reps: set.reps,
                rir: set.rir,
                tipo: set.tipo,
                es_pr: set.esPr,
                molestia: set.molestiaFlag
                  ? { zona: set.molestiaZona, nivel_1a10: set.molestiaNivel1a10 }
                  : null,
                notas: set.notas,
              })),
            }
          : {}),
      };
    }),

    prs: prs.map((pr) => ({
      ejercicio: pr.exercise.nombre,
      tipo: pr.tipo,
      valor: pr.tipo === "REPS_A_PESO" ? pr.valor : kgALb(pr.valor),
      unidad: pr.tipo === "REPS_A_PESO" ? "reps" : "lb",
      peso_lb: pr.pesoKg != null ? kgALb(pr.pesoKg) : null,
      reps: pr.reps,
      pr_anterior: pr.prAnteriorValor != null
        ? pr.tipo === "REPS_A_PESO"
          ? pr.prAnteriorValor
          : kgALb(pr.prAnteriorValor)
        : null,
      fecha: localDayString(pr.logradoEn),
    })),

    // Métricas corporales en kg, no en libras (SPEC §5): es la unidad en la
    // que Alejandro las lee en la báscula.
    metricas_corporales: metricas.map((m) => ({
      fecha: dateOnlyString(m.fecha),
      peso_kg: m.pesoKg,
      grasa_pct: m.grasaPct,
      grasa_visceral: m.grasaVisceral,
      masa_muscular_kg: m.masaMuscularKg,
      cintura_cm: m.cinturaCm,
      pecho_cm: m.pechoCm,
      brazo_d_cm: m.brazoDCm,
      muslo_d_cm: m.musloDCm,
    })),
  };
}
