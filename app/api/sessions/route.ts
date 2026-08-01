import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";

export async function GET(req: NextRequest) {
  const atletaId = await getAthleteId();
  const estado = req.nextUrl.searchParams.get("estado");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");

  const sessions = await prisma.sessionLog.findMany({
    where: { atletaId, estado: estado ? (estado as never) : undefined },
    orderBy: [{ finalizadaEn: "desc" }, { iniciadaEn: "desc" }],
    take: limit,
    include: {
      _count: { select: { setLogs: true } },
    },
  });

  return NextResponse.json({ sessions });
}
