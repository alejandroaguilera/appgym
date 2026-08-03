import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Limpieza puntual #2: la guarda anterior (por setLogId) no cubría el caso
// de series empatadas en peso — dos corridas duplicadas de detectAndSavePRs
// podían elegir un setLogId distinto como "ganador" para el mismo
// (sesión, ejercicio, tipo). Agrupa por sesión real (via SetLog.sessionLogId)
// para los PRs con setLogId, y por (ejercicio, tipo, valor, prAnteriorValor)
// para VOLUMEN (que no tiene setLogId). Se borra este endpoint después de
// correrlo una vez.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (token !== process.env.SEED_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const all = await prisma.personalRecord.findMany({ orderBy: { createdAt: "asc" } });

  const setLogIds = all.map((pr) => pr.setLogId).filter((id): id is string => !!id);
  const setLogs = await prisma.setLog.findMany({
    where: { id: { in: setLogIds } },
    select: { id: true, sessionLogId: true },
  });
  const sessionBySetLogId = new Map(setLogs.map((s) => [s.id, s.sessionLogId]));

  const groups = new Map<string, string[]>();
  for (const pr of all) {
    const key = pr.setLogId
      ? `set:${sessionBySetLogId.get(pr.setLogId)}:${pr.exerciseId}:${pr.tipo}`
      : `vol:${pr.exerciseId}:${pr.tipo}:${pr.valor}:${pr.prAnteriorValor}`;
    const arr = groups.get(key) ?? [];
    arr.push(pr.id);
    groups.set(key, arr);
  }

  const toDelete: string[] = [];
  for (const ids of groups.values()) {
    if (ids.length > 1) toDelete.push(...ids.slice(1));
  }

  if (toDelete.length > 0) {
    await prisma.personalRecord.deleteMany({ where: { id: { in: toDelete } } });
  }

  return NextResponse.json({ total: all.length, grupos: groups.size, borrados: toDelete.length });
}
