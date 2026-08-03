import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExportToken } from "@/lib/exportAuth";

export async function GET(req: NextRequest) {
  const auth = await requireExportToken(req);
  if (typeof auth !== "string") return auth;
  const atletaId = auth;

  const prs = await prisma.personalRecord.findMany({
    where: { atletaId },
    orderBy: { logradoEn: "desc" },
    include: { exercise: { select: { nombre: true, grupoMuscularPrimario: true } } },
  });

  return NextResponse.json({
    version: 1,
    prs: prs.map((pr) => ({
      ejercicio: pr.exercise.nombre,
      grupoMuscularPrimario: pr.exercise.grupoMuscularPrimario,
      tipo: pr.tipo,
      valor: pr.valor,
      pesoKg: pr.pesoKg,
      reps: pr.reps,
      logradoEn: pr.logradoEn.toISOString(),
      prAnteriorValor: pr.prAnteriorValor,
      estimacionBajaConfianza: pr.estimacionBajaConfianza,
    })),
  });
}
