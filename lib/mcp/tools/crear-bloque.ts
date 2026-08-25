import { prisma } from "@/lib/prisma";
import { dateOnlyString } from "@/lib/date";
import { kgALb } from "@/lib/mcp/units";
import { ErrorAccionable } from "./ajustar-semana";

const REPS_MIN_FISIO = 10;
const DESCANSO_POR_DEFECTO_SEG = 120;

export interface EjercicioDeBloque {
  ejercicio_id: string;
  orden: number;
  series: number;
  reps_min: number;
  reps_max?: number | null;
  rir_objetivo?: number | null;
  descanso_seg?: number | null;
  nota?: string | null;
}

export interface SesionDeBloque {
  letra: string;
  nombre: string;
  orden?: number;
  notas?: string | null;
  ejercicios: EjercicioDeBloque[];
}

// SPEC §5.4, la operación ocasional. Define la estructura del ciclo: qué
// sesiones hay y con qué ejercicios. Las cargas semanales se afinan después con
// ajustar_semana — este bloque es el esqueleto, no la prescripción del día.
export async function crearBloque(
  atletaId: string,
  args: {
    id?: string;
    nombre: string;
    fecha_inicio: string;
    fecha_fin: string;
    notas?: string | null;
    activar?: boolean;
    sesiones: SesionDeBloque[];
  }
) {
  const activar = args.activar ?? true;
  const fechaInicio = new Date(`${args.fecha_inicio}T00:00:00.000Z`);
  const fechaFin = new Date(`${args.fecha_fin}T00:00:00.000Z`);

  if (Number.isNaN(fechaInicio.getTime()) || Number.isNaN(fechaFin.getTime())) {
    throw new ErrorAccionable(
      `Fechas inválidas: fecha_inicio="${args.fecha_inicio}", fecha_fin="${args.fecha_fin}". Usa el formato YYYY-MM-DD.`
    );
  }
  if (fechaFin < fechaInicio) {
    throw new ErrorAccionable(`fecha_fin (${args.fecha_fin}) es anterior a fecha_inicio (${args.fecha_inicio}).`);
  }
  if (args.sesiones.length === 0) {
    throw new ErrorAccionable("Un bloque necesita al menos una sesión. Sin plantillas la semana nunca puede completarse.");
  }

  const claves = args.sesiones.map((s) => s.letra.toUpperCase());
  const repetidas = claves.filter((c, i) => claves.indexOf(c) !== i);
  if (repetidas.length > 0) {
    throw new ErrorAccionable(`Las letras de sesión deben ser únicas dentro del bloque. Repetidas: ${[...new Set(repetidas)].join(", ")}.`);
  }
  const largas = claves.filter((c) => c.length !== 1);
  if (largas.length > 0) {
    throw new ErrorAccionable(`La letra de una sesión es un solo carácter (A, B, C…). Recibí: ${largas.join(", ")}.`);
  }

  // ── Guarda 1: el historial cierra la ventana de corrección ──
  // Reescribir un bloque es legítimo mientras nadie haya entrenado sobre él.
  // En cuanto hay una sesión con series, sus plantillas son el "contra qué" de
  // ese log y borrarlas dejaría el historial sin referencia.
  const existente = args.id
    ? await prisma.block.findUnique({
        where: { id: args.id },
        include: { sessionTemplates: { select: { id: true } } },
      })
    : null;

  if (existente) {
    if (existente.atletaId !== atletaId) {
      throw new ErrorAccionable(`El bloque ${args.id} no es de este atleta.`);
    }
    const entrenadas = await prisma.sessionLog.count({
      where: { sessionTemplateId: { in: existente.sessionTemplates.map((t) => t.id) } },
    });
    if (entrenadas > 0) {
      throw new ErrorAccionable(
        `El bloque "${existente.nombre}" ya tiene ${entrenadas} sesión(es) registrada(s) y no puede reescribirse. Crea un bloque nuevo (sin pasar id) o corrige en la app.`
      );
    }
  }

  // ── Guarda 5: ids reales ──
  const idsPedidos = [...new Set(args.sesiones.flatMap((s) => s.ejercicios.map((e) => e.ejercicio_id)))];
  const ejercicios = await prisma.exercise.findMany({ where: { id: { in: idsPedidos } } });
  const porId = new Map(ejercicios.map((e) => [e.id, e]));
  const faltantes = idsPedidos.filter((id) => !porId.has(id));
  if (faltantes.length > 0) {
    throw new ErrorAccionable(
      `No existe ejercicio con id ${faltantes.join(", ")}. Usa catalogo_ejercicios para resolver el nombre a un id real.`
    );
  }

  const advertencias: string[] = [];

  for (const s of args.sesiones) {
    for (const e of s.ejercicios) {
      const ejercicio = porId.get(e.ejercicio_id)!;
      if (e.reps_min < REPS_MIN_FISIO && ejercicio.equipo !== "PESO_CORPORAL") {
        advertencias.push(
          `${ejercicio.nombre} (sesión ${s.letra.toUpperCase()}) tiene reps_min=${e.reps_min}, por debajo del criterio de 10-20 reps indicado por el fisio para el hombro.`
        );
      }
    }
  }

  // Traslape de rangos: se advierte, no se rechaza. En este repo lo que hace
  // inequívoco al "bloque vigente" es `estado: ACTIVO` (es lo que consulta
  // /api/today), no el rango de fechas — así que un traslape ya no genera la
  // ambigüedad que el spec quería evitar. Rechazarlo impediría el caso normal
  // de cerrar un bloque antes de tiempo y arrancar el siguiente, que es
  // justamente una decisión que le toca al coach.
  const traslapados = await prisma.block.findMany({
    where: {
      atletaId,
      ...(existente ? { id: { not: existente.id } } : {}),
      fechaInicio: { lte: fechaFin },
      fechaFin: { gte: fechaInicio },
    },
    select: { nombre: true, fechaInicio: true, fechaFin: true, estado: true },
  });
  for (const b of traslapados) {
    advertencias.push(
      `El rango se traslapa con "${b.nombre}" (${dateOnlyString(b.fechaInicio)} → ${dateOnlyString(b.fechaFin)}, ${b.estado}).${activar ? ` Ese bloque pasa a COMPLETADO.` : ""}`
    );
  }

  // ── Guarda 3: todo en una transacción, nada a medio crear ──
  const block = await prisma.$transaction(async (tx) => {
    if (existente) {
      // Sin sesiones registradas (ya se verificó): borrar en cascada las
      // plantillas viejas es seguro y es lo que hace que pasar el mismo id dos
      // veces sobrescriba en vez de duplicar.
      await tx.block.delete({ where: { id: existente.id } });
    }

    // Mismo comportamiento que POST /api/blocks: activar un bloque degrada el
    // anterior a COMPLETADO. Es la manera real de "cerrar el ciclo y abrir uno
    // nuevo" en este repo.
    if (activar) {
      await tx.block.updateMany({
        where: { atletaId, estado: "ACTIVO" },
        data: { estado: "COMPLETADO" },
      });
    }

    return tx.block.create({
      data: {
        ...(args.id ? { id: args.id } : {}),
        atletaId,
        nombre: args.nombre,
        fechaInicio,
        fechaFin,
        estado: activar ? "ACTIVO" : "BORRADOR",
        notas: args.notas ?? null,
        sessionTemplates: {
          create: args.sesiones.map((s, i) => ({
            clave: s.letra.toUpperCase(),
            nombre: s.nombre,
            orden: s.orden ?? i + 1,
            notas: s.notas ?? null,
            templateExercises: {
              create: s.ejercicios.map((e) => ({
                exerciseId: e.ejercicio_id,
                orden: e.orden,
                seriesObjetivo: e.series,
                repsMin: e.reps_min,
                repsMax: e.reps_max ?? null,
                rirObjetivo: e.rir_objetivo ?? null,
                descansoSeg: e.descanso_seg ?? DESCANSO_POR_DEFECTO_SEG,
                notas: e.nota ?? null,
              })),
            },
          })),
        },
      },
      include: {
        sessionTemplates: {
          orderBy: { orden: "asc" },
          include: {
            templateExercises: { orderBy: { orden: "asc" }, include: { exercise: true } },
          },
        },
      },
    });
  });

  // El WeekCycle 1 no se crea aquí a propósito: getOrCreateOpenCycle lo abre
  // solo la primera vez que Alejandro consulta /api/today. Crearlo ahora le
  // pondría al ciclo una fecha de inicio anterior a que el bloque existiera
  // en pantalla.
  return {
    bloque: {
      id: block.id,
      nombre: block.nombre,
      estado: block.estado,
      fecha_inicio: dateOnlyString(block.fechaInicio),
      fecha_fin: dateOnlyString(block.fechaFin),
      notas: block.notas,
      sesiones: block.sessionTemplates.map((t) => ({
        id: t.id,
        letra: t.clave,
        nombre: t.nombre,
        orden: t.orden,
        ejercicios: t.templateExercises.map((te) => ({
          ejercicio_id: te.exerciseId,
          nombre: te.exercise.nombre,
          orden: te.orden,
          series: te.seriesObjetivo,
          reps_min: te.repsMin,
          reps_max: te.repsMax,
          rir_objetivo: te.rirObjetivo,
          descanso_seg: te.descansoSeg,
          incremento_minimo_lb: kgALb(te.exercise.incrementoMinimoKg),
          nota: te.notas,
        })),
      })),
    },
    ...(advertencias.length > 0 ? { advertencias } : {}),
    siguiente_paso: `El bloque no tiene cargas prescritas todavía: la app calculará el peso por doble progresión hasta que uses ajustar_semana. Prescribe la semana 1 con ajustar_semana si quieres fijar las cargas de arranque.`,
  };
}
