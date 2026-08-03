import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Limpieza única de PersonalRecord duplicados generados por la falta de
// idempotencia en detectAndSavePRs (corregido en lib/services/closeSession.ts).
// Se borra después de usarse una vez, mismo patrón que el bootstrap de siembra.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.SEED_TOKEN || token !== process.env.SEED_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const all = await prisma.personalRecord.findMany({ orderBy: { createdAt: "asc" } });

  const vistos = new Set<string>();
  const idsABorrar: string[] = [];
  for (const pr of all) {
    const key = pr.setLogId ? `set:${pr.setLogId}:${pr.tipo}` : `vol:${pr.exerciseId}:${pr.tipo}:${pr.valor}`;
    if (vistos.has(key)) {
      idsABorrar.push(pr.id);
    } else {
      vistos.add(key);
    }
  }

  if (idsABorrar.length > 0) {
    await prisma.personalRecord.deleteMany({ where: { id: { in: idsABorrar } } });
  }

  return NextResponse.json({ total: all.length, borrados: idsABorrar.length });
}
