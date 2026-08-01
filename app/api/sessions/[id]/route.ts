import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await prisma.sessionLog.findUnique({
    where: { id },
    include: {
      setLogs: {
        orderBy: [{ exerciseId: "asc" }, { numeroSerie: "asc" }],
        include: { exercise: { select: { nombre: true, grupoMuscularPrimario: true } } },
      },
    },
  });

  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  // sessionTemplateId es una referencia suelta (no FK) — el historial de
  // ejecución no depende de que la plantilla siga existiendo o sin editar.
  const sessionTemplate = session.sessionTemplateId
    ? await prisma.sessionTemplate.findUnique({
        where: { id: session.sessionTemplateId },
        select: { clave: true, nombre: true },
      })
    : null;

  return NextResponse.json({ session, sessionTemplate });
}
