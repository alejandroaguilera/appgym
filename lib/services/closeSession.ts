import { prisma } from "@/lib/prisma";
import { detectPRs, type HistoricalBests, type DetectedPR } from "@/lib/logic/prs";
import { SET_NO_CALENTAMIENTO } from "@/lib/logic/volumen";

interface ExercisePR extends DetectedPR {
  exerciseId: string;
}

// §6.2: run once a session transitions to COMPLETADA. Evaluates PRs per
// exercise (ignoring calentamiento sets) against the athlete's history
// excluding this session, persists them, and flags the winning SetLogs.
export async function detectAndSavePRs(sessionLogId: string, atletaId: string): Promise<ExercisePR[]> {
  // Idempotencia: el cierre de sesión puede llegar al servidor más de una
  // vez (el fetch inmediato de la revelación de PRs y el fallback de
  // sendBeacon pueden competir por el mismo cierre). Este UPDATE es el
  // reclamo atómico: solo el primer llamador lo gana (count === 1) — a
  // diferencia de un `findFirst` previo a la escritura, no deja ventana de
  // carrera entre dos invocaciones concurrentes, y cubre también los PRs
  // tipo VOLUMEN (que no tienen setLogId propio). El perdedor de la carrera
  // devuelve una lista vacía en vez de reconsultar — nada distinto de la app
  // depende de ese valor de retorno salvo el toast de revelación inmediata.
  const claim = await prisma.sessionLog.updateMany({
    where: { id: sessionLogId, prsDetectadosEn: null },
    data: { prsDetectadosEn: new Date() },
  });
  if (claim.count === 0) return [];

  const sets = await prisma.setLog.findMany({
    where: { sessionLogId, ...SET_NO_CALENTAMIENTO },
  });
  if (sets.length === 0) return [];

  const byExercise = new Map<string, typeof sets>();
  for (const s of sets) {
    const arr = byExercise.get(s.exerciseId) ?? [];
    arr.push(s);
    byExercise.set(s.exerciseId, arr);
  }

  const allPRs: ExercisePR[] = [];
  for (const [exerciseId, exSets] of byExercise) {
    const historical = await getHistoricalBests(atletaId, exerciseId, sessionLogId);
    const prs = detectPRs(
      exSets.map((s) => ({ id: s.id, pesoKg: s.pesoKg, reps: s.reps })),
      historical
    );
    for (const pr of prs) allPRs.push({ ...pr, exerciseId });
  }

  if (allPRs.length > 0) {
    await prisma.personalRecord.createMany({
      data: allPRs.map((pr) => ({
        atletaId,
        exerciseId: pr.exerciseId,
        tipo: pr.tipo,
        valor: pr.valor,
        pesoKg: pr.pesoKg,
        reps: pr.reps,
        setLogId: pr.setLogId,
        logradoEn: new Date(),
        prAnteriorValor: pr.prAnteriorValor,
        estimacionBajaConfianza: pr.estimacionBajaConfianza,
      })),
    });

    const setLogIds = allPRs.map((p) => p.setLogId).filter((id): id is string => !!id);
    if (setLogIds.length > 0) {
      await prisma.setLog.updateMany({ where: { id: { in: setLogIds } }, data: { esPr: true } });
    }
  }

  return allPRs;
}

async function getHistoricalBests(
  atletaId: string,
  exerciseId: string,
  excludeSessionLogId: string
): Promise<HistoricalBests> {
  const priorSets = await prisma.setLog.findMany({
    where: {
      exerciseId,
      ...SET_NO_CALENTAMIENTO,
      sessionLogId: { not: excludeSessionLogId },
      sessionLog: { atletaId, estado: "COMPLETADA" },
    },
    select: { pesoKg: true, reps: true, sessionLogId: true },
  });

  let pesoMax: number | null = null;
  let e1rmMax: number | null = null;
  const repsMaxPorPeso: Record<number, number> = {};
  const volumenPorSesion = new Map<string, number>();

  for (const s of priorSets) {
    if (pesoMax === null || s.pesoKg > pesoMax) pesoMax = s.pesoKg;
    const e1rm = s.pesoKg * (1 + s.reps / 30);
    if (e1rmMax === null || e1rm > e1rmMax) e1rmMax = e1rm;
    repsMaxPorPeso[s.pesoKg] = Math.max(repsMaxPorPeso[s.pesoKg] ?? 0, s.reps);
    volumenPorSesion.set(s.sessionLogId, (volumenPorSesion.get(s.sessionLogId) ?? 0) + s.pesoKg * s.reps);
  }

  const volumenMaxSesion = volumenPorSesion.size > 0 ? Math.max(...volumenPorSesion.values()) : null;

  return { pesoMax, e1rmMax, volumenMaxSesion, repsMaxPorPeso };
}
