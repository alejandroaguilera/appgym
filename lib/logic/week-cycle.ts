import { prisma } from "@/lib/prisma";
import type { WeekCycle } from "@prisma/client";

// La semana de entrenamiento es un ciclo de progreso: avanza cuando el atleta
// completó cada plantilla del bloque una vez, no cuando pasaron siete días.
// El ciclo abierto (cerradaEn null) es la fuente de verdad de `numeroSemana`,
// de la ventana contra la que se mide "ya completé esta sesión" y del momento
// en que se dispara la celebración.

// Devuelve el ciclo abierto del bloque, creándolo si no existe. La creación es
// perezosa a propósito: un bloque recién creado no necesita fila hasta que se
// consulte /api/today por primera vez.
export async function getOrCreateOpenCycle(atletaId: string, blockId: string): Promise<WeekCycle> {
  const abierto = await prisma.weekCycle.findFirst({
    where: { blockId, cerradaEn: null },
    orderBy: { numeroSemana: "desc" },
  });
  if (abierto) return abierto;

  const ultimoCerrado = await prisma.weekCycle.findFirst({
    where: { blockId },
    orderBy: { numeroSemana: "desc" },
  });

  return prisma.weekCycle.create({
    data: {
      atletaId,
      blockId,
      numeroSemana: (ultimoCerrado?.numeroSemana ?? 0) + 1,
      // Sin hueco entre semanas: la nueva arranca donde terminó la anterior,
      // para que ninguna sesión caiga en tierra de nadie entre dos ciclos.
      iniciadaEn: ultimoCerrado?.cerradaEn ?? new Date(),
    },
  });
}

// Cierra el ciclo y abre el siguiente. Idempotente: si el ciclo ya estaba
// cerrado (doble tap en el overlay, o un reintento de red) devuelve el
// siguiente que ya existe en vez de crear un duplicado o reventar contra el
// unique de (blockId, numeroSemana).
export async function closeCycleAndOpenNext(cycleId: string): Promise<WeekCycle> {
  const cycle = await prisma.weekCycle.findUniqueOrThrow({ where: { id: cycleId } });

  let cerradaEn = cycle.cerradaEn;
  if (!cerradaEn) {
    cerradaEn = new Date();
    await prisma.weekCycle.update({
      where: { id: cycleId },
      data: { cerradaEn, celebradaEn: cycle.celebradaEn ?? cerradaEn },
    });
  }

  return prisma.weekCycle.upsert({
    where: { blockId_numeroSemana: { blockId: cycle.blockId, numeroSemana: cycle.numeroSemana + 1 } },
    create: {
      atletaId: cycle.atletaId,
      blockId: cycle.blockId,
      numeroSemana: cycle.numeroSemana + 1,
      iniciadaEn: cerradaEn,
    },
    update: {},
  });
}

interface CycleLite {
  numeroSemana: number;
  iniciadaEn: Date;
  cerradaEn: Date | null;
}

// El ciclo cuyo rango [iniciadaEn, cerradaEn) contiene `date`. Para etiquetar
// sesiones históricas con su número de semana en el export — el cálculo por
// calendario daría un número distinto al que el atleta vio cuando entrenó.
export function resolveCycleForDate<T extends CycleLite>(cycles: T[], date: Date): T | null {
  const t = date.getTime();
  return (
    cycles.find(
      (c) => t >= c.iniciadaEn.getTime() && (c.cerradaEn === null || t < c.cerradaEn.getTime())
    ) ?? null
  );
}
