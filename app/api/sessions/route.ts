import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";
import { SET_NO_CALENTAMIENTO, sumVolumenKg } from "@/lib/logic/volumen";

export async function GET(req: NextRequest) {
  const atletaId = await getAthleteId();
  const estado = req.nextUrl.searchParams.get("estado");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");

  const sessions = await prisma.sessionLog.findMany({
    where: {
      atletaId,
      estado: estado ? (estado as never) : undefined,
      // Sesiones de prueba sin ninguna serie de trabajo real no cuentan como
      // historial — no tiene sentido mostrárselas al atleta.
      setLogs: { some: SET_NO_CALENTAMIENTO },
    },
    orderBy: [{ finalizadaEn: "desc" }, { iniciadaEn: "desc" }],
    take: limit,
    include: {
      _count: { select: { setLogs: true } },
      setLogs: { where: SET_NO_CALENTAMIENTO, select: { pesoKg: true, reps: true } },
    },
  });

  // sessionTemplateId es una referencia suelta (no FK) — se resuelve aparte
  // en lote, igual que en GET /api/sessions/[id].
  const templateIds = [...new Set(sessions.map((s) => s.sessionTemplateId).filter((id): id is string => !!id))];
  const templates = templateIds.length
    ? await prisma.sessionTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, clave: true, nombre: true },
      })
    : [];
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const withVolumen = sessions.map(({ setLogs, ...s }) => ({
    ...s,
    volumenKg: sumVolumenKg(setLogs),
    sessionTemplate: s.sessionTemplateId ? templateById.get(s.sessionTemplateId) ?? null : null,
  }));

  return NextResponse.json({ sessions: withVolumen });
}
