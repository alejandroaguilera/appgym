import { prisma } from "@/lib/prisma";
import { SET_NO_CALENTAMIENTO } from "@/lib/logic/volumen";
import { enCiclo } from "@/lib/logic/week-cycle";
import { resolveWeekPlan } from "@/lib/logic/week-plan";
import { resolveWeekOverride } from "@/lib/logic/week-resolve";
import { ajustarAIncremento, kgALb } from "@/lib/mcp/units";

export interface EjercicioPrescrito {
  ejercicio_id: string;
  orden: number;
  series: number;
  reps_min: number;
  reps_max?: number | null;
  rir_objetivo?: number | null;
  peso_objetivo_lb?: number | null;
  descanso_seg?: number | null;
  nota?: string | null;
}

export interface SesionPrescrita {
  letra: string;
  ejercicios: EjercicioPrescrito[];
}

export class ErrorAccionable extends Error {}

// El criterio del fisio para el hombro. Se advierte, no se rechaza: la
// indicación puede cambiar si lo libera, y la app no debe congelar una regla
// clínica. Pero mientras exista, hace imposible violarla en silencio.
const REPS_MIN_FISIO = 10;

// SPEC §5.5, la herramienta principal. Escribe cómo se ve la semana que viene:
// carga, reps, series, RIR y qué ejercicios entran o salen.
//
// La prescripción vive en WeekPrescription, un modelo nuevo: antes no había
// dónde guardar carga por ejercicio y por semana (ver §0.4 del reporte). Las
// filas de una (semana, plantilla) son la lista completa de esa sesión, así
// que reescribir una semana es borrar y volver a crear, no parchear.
export async function ajustarSemana(
  atletaId: string,
  args: { numero_semana: number; sesiones: SesionPrescrita[]; nota_semana?: string | null }
) {
  const block = await prisma.block.findFirst({
    where: { atletaId, estado: "ACTIVO" },
    include: {
      sessionTemplates: {
        orderBy: { orden: "asc" },
        include: {
          templateExercises: { orderBy: { orden: "asc" }, include: { exercise: true } },
        },
      },
      weekOverrides: true,
    },
  });

  if (!block) {
    throw new ErrorAccionable(
      "No hay ningún bloque ACTIVO sobre el que prescribir. Usa crear_bloque para abrir uno primero."
    );
  }

  const templateIds = block.sessionTemplates.map((t) => t.id);
  const porLetra = new Map(block.sessionTemplates.map((t) => [t.clave.toUpperCase(), t]));

  // ── Guarda 2: sólo semanas del bloque vigente que no hayan quedado atrás ──
  const ciclo = await prisma.weekCycle.findUnique({
    where: { blockId_numeroSemana: { blockId: block.id, numeroSemana: args.numero_semana } },
  });

  if (ciclo?.cerradaEn) {
    throw new ErrorAccionable(
      `La semana ${args.numero_semana} ya cerró el ${ciclo.cerradaEn.toISOString().slice(0, 10)}. No se reescribe lo que ya pasó; prescribe una semana posterior.`
    );
  }

  // ── Guarda 1: sólo semanas sin entrenar ──
  // Misma ventana que usa /api/today para decidir qué cuenta como sesión de
  // esta semana, para que el MCP no acepte reescribir algo que la app ya le
  // mostró al atleta como entrenado.
  if (ciclo) {
    const yaEntrenadas = await prisma.sessionLog.count({
      where: {
        atletaId,
        estado: "COMPLETADA",
        archivadaEn: null,
        sessionTemplateId: { in: templateIds },
        ...enCiclo(ciclo),
        setLogs: { some: SET_NO_CALENTAMIENTO },
      },
    });
    if (yaEntrenadas > 0) {
      throw new ErrorAccionable(
        `La semana ${args.numero_semana} ya tiene ${yaEntrenadas} sesión(es) entrenada(s). No se reescribe una semana en curso; prescribe la ${args.numero_semana + 1}.`
      );
    }
  }

  // ── Guarda 4: ids reales, nunca creación silenciosa ──
  const idsPedidos = [...new Set(args.sesiones.flatMap((s) => s.ejercicios.map((e) => e.ejercicio_id)))];
  const ejercicios = await prisma.exercise.findMany({ where: { id: { in: idsPedidos } } });
  const porId = new Map(ejercicios.map((e) => [e.id, e]));
  const faltantes = idsPedidos.filter((id) => !porId.has(id));
  if (faltantes.length > 0) {
    throw new ErrorAccionable(
      `No existe ejercicio con id ${faltantes.join(", ")}. Usa catalogo_ejercicios para resolver el nombre a un id real.`
    );
  }

  const letrasMalas = args.sesiones.map((s) => s.letra.toUpperCase()).filter((l) => !porLetra.has(l));
  if (letrasMalas.length > 0) {
    throw new ErrorAccionable(
      `El bloque "${block.nombre}" no tiene sesión con letra ${letrasMalas.join(", ")}. Las que tiene: ${[...porLetra.keys()].join(", ")}.`
    );
  }

  const advertencias: string[] = [];

  // ── Armado de filas, con redondeo al incremento real del equipo ──
  const filas = args.sesiones.flatMap((sesion) => {
    const template = porLetra.get(sesion.letra.toUpperCase())!;
    return sesion.ejercicios.map((e) => {
      const ejercicio = porId.get(e.ejercicio_id)!;

      let pesoObjetivoKg: number | null = null;
      if (e.peso_objetivo_lb != null) {
        const { pesoKg, pesoLb, ajustado } = ajustarAIncremento(
          e.peso_objetivo_lb,
          ejercicio.incrementoMinimoKg
        );
        pesoObjetivoKg = pesoKg;
        if (ajustado) {
          advertencias.push(
            `${ejercicio.nombre}: ${e.peso_objetivo_lb} lb no es múltiplo del incremento del equipo (${kgALb(ejercicio.incrementoMinimoKg)} lb). Se guardó ${pesoLb} lb.`
          );
        }
      }

      if (e.reps_min < REPS_MIN_FISIO && ejercicio.equipo !== "PESO_CORPORAL") {
        advertencias.push(
          `${ejercicio.nombre} tiene reps_min=${e.reps_min}, por debajo del criterio de 10-20 reps indicado por el fisio para el hombro.`
        );
      }

      return {
        blockId: block.id,
        numeroSemana: args.numero_semana,
        sessionTemplateId: template.id,
        exerciseId: e.ejercicio_id,
        orden: e.orden,
        seriesObjetivo: e.series,
        repsMin: e.reps_min,
        repsMax: e.reps_max ?? null,
        rirObjetivo: e.rir_objetivo ?? null,
        pesoObjetivoKg,
        descansoSeg: e.descanso_seg ?? null,
        // La nota se reemplaza completa, nunca se agrega (SPEC §5.5): una
        // prescripción vieja presentada como vigente es peor que ninguna.
        nota: e.nota ?? null,
      };
    });
  });

  // ── Guarda 3: idempotente por (bloque, semana) ──
  // Borrar y recrear dentro de una transacción, no upsert fila por fila: si el
  // coach saca un ejercicio de la semana, el upsert lo dejaría ahí para
  // siempre. Llamar dos veces deja un ajuste, no dos.
  await prisma.$transaction(async (tx) => {
    await tx.weekPrescription.deleteMany({
      where: { blockId: block.id, numeroSemana: args.numero_semana },
    });
    if (filas.length > 0) await tx.weekPrescription.createMany({ data: filas });

    if (args.nota_semana !== undefined) {
      // El foco de la semana ya tenía dónde vivir: WeekOverride.nota es lo que
      // /api/today expone como `focoSemana`. No hacía falta un campo nuevo.
      await tx.weekOverride.upsert({
        where: { blockId_numeroSemana: { blockId: block.id, numeroSemana: args.numero_semana } },
        create: {
          blockId: block.id,
          numeroSemana: args.numero_semana,
          nota: args.nota_semana,
          rirObjetivo: null,
        },
        update: { nota: args.nota_semana },
      });
    }
  });

  // ── Guarda 5: devolver la semana resultante, no asumirla ──
  return leerSemana(block, args.numero_semana, advertencias);
}

type BlockConPlantillas = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.block.findFirst<{
        include: {
          sessionTemplates: {
            include: { templateExercises: { include: { exercise: true } } };
          };
          weekOverrides: true;
        };
      }>
    >
  >
>;

// Se relee desde la base y se pasa por resolveWeekPlan —el mismo resolvedor que
// usa /api/today— en vez de devolver lo que se acaba de escribir. Así lo que ve
// el coach es literalmente lo que va a ver Alejandro en la app.
async function leerSemana(block: BlockConPlantillas, numeroSemana: number, advertencias: string[]) {
  const prescripciones = await prisma.weekPrescription.findMany({
    where: { blockId: block.id, numeroSemana },
    orderBy: { orden: "asc" },
    include: { exercise: true },
  });
  const override = resolveWeekOverride(block.weekOverrides, numeroSemana);
  const notaSemana =
    (await prisma.weekOverride.findUnique({
      where: { blockId_numeroSemana: { blockId: block.id, numeroSemana } },
    }))?.nota ?? null;

  return {
    bloque: { id: block.id, nombre: block.nombre },
    numero_semana: numeroSemana,
    nota_semana: notaSemana,
    ...(advertencias.length > 0 ? { advertencias } : {}),
    sesiones: block.sessionTemplates.map((t) => {
      const delTemplate = prescripciones.filter((p) => p.sessionTemplateId === t.id);
      const plan = resolveWeekPlan(t.templateExercises, delTemplate, override);
      return {
        letra: t.clave,
        nombre: t.nombre,
        // "coach" = esta sesión quedó prescrita para la semana. "plantilla" =
        // no se tocó y Alejandro verá el plan base con el peso calculado.
        origen: plan[0]?.origen ?? "plantilla",
        ejercicios: plan.map((i) => ({
          ejercicio_id: i.exerciseId,
          nombre: i.exercise.nombre,
          orden: i.orden,
          series: i.seriesObjetivo,
          reps_min: i.repsMin,
          reps_max: i.repsMax,
          rir_objetivo: i.rirObjetivo,
          peso_objetivo_lb: i.pesoObjetivoKg != null ? kgALb(i.pesoObjetivoKg) : null,
          descanso_seg: i.descansoSeg,
          nota: i.notas,
        })),
      };
    }),
  };
}
