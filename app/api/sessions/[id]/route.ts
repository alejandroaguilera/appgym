import { NextRequest, NextResponse } from "next/server";
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

// Archivar/desarchivar — visibilidad, no un estado más del ciclo de vida de
// la sesión (ver comentario en el schema). `{ archivada: true }` para
// archivar, `{ archivada: false }` para restaurar.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const archivada = Boolean(body.archivada);

  const session = await prisma.sessionLog.update({
    where: { id },
    data: { archivadaEn: archivada ? new Date() : null },
  });

  return NextResponse.json({ session });
}
