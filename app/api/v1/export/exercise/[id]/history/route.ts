import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExportToken } from "@/lib/exportAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireExportToken(req);
  if (typeof auth !== "string") return auth;
  const atletaId = auth;
  const { id } = await params;

  const exercise = await prisma.exercise.findUnique({
    where: { id },
    select: { nombre: true, grupoMuscularPrimario: true },
  });
  if (!exercise) return NextResponse.json({ error: "ejercicio no encontrado" }, { status: 404 });

  const sets = await prisma.setLog.findMany({
    where: { exerciseId: id, sessionLog: { atletaId, estado: "COMPLETADA", archivadaEn: null } },
    orderBy: { completadaEn: "asc" },
    select: {
      completadaEn: true,
      sessionLogId: true,
      pesoKg: true,
      reps: true,
      rir: true,
      tipo: true,
      esPr: true,
    },
  });

  return NextResponse.json({
    version: 1,
    ejercicio: exercise.nombre,
    grupoMuscularPrimario: exercise.grupoMuscularPrimario,
    historial: sets.map((s) => ({
      fecha: s.completadaEn.toISOString(),
      sessionId: s.sessionLogId,
      pesoKg: s.pesoKg,
      reps: s.reps,
      rir: s.rir,
      tipo: s.tipo,
      esPr: s.esPr,
    })),
  });
}
