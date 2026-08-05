import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertSessionLog, deleteSessionLog } from "@/lib/services/sessionLog";
import { detectAndSavePRs } from "@/lib/services/closeSession";

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

// Sincronización del outbox local (§5.2/§5.3) — upsert idempotente por id,
// llamado por el fetch inmediato del ejecutor al cerrar sesión y por el
// drenado normal de la cola. Si la sesión queda COMPLETADA, corre la
// detección de PRs (§6.2, idempotente vía el reclamo atómico en
// detectAndSavePRs) y la devuelve para la revelación en el ejecutor.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const sessionLog = await upsertSessionLog({ ...body, id });

  const prs = sessionLog.estado === "COMPLETADA" ? await detectAndSavePRs(sessionLog.id, sessionLog.atletaId) : [];

  return NextResponse.json({ session: sessionLog, prs });
}

// Archivar/desarchivar — visibilidad, no un estado más del ciclo de vida de
// la sesión (ver comentario en el schema). `{ archivada: true }` para
// archivar, `{ archivada: false }` para restaurar.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const archivada = Boolean(body.archivada);

  const session = await prisma.sessionLog.update({
    where: { id },
    data: { archivadaEn: archivada ? new Date() : null },
  });

  return NextResponse.json({ session });
}

// Descartar una sesión en ejecución: borrado real, no un estado más. Las
// series caen por `onDelete: Cascade`. PersonalRecord.setLogId es una
// referencia suelta sin FK, así que no bloquea el borrado — y de todos modos
// una sesión descartada nunca llegó a COMPLETADA, el único estado en el que
// detectAndSavePRs escribe PRs.
//
// `deleteMany` en vez de `delete` a propósito: el outbox puede reintentar este
// DELETE (drenado normal + fallback de sendBeacon) y borrar cero filas es el
// resultado correcto la segunda vez, no un 404.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const borradas = await deleteSessionLog(id);
  return NextResponse.json({ borradas });
}
