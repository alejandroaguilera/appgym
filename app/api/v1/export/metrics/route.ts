import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExportToken } from "@/lib/exportAuth";

export async function GET(req: NextRequest) {
  const auth = await requireExportToken(req);
  if (typeof auth !== "string") return auth;
  const atletaId = auth;

  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");

  const metrics = await prisma.bodyMetric.findMany({
    where: {
      atletaId,
      fecha: {
        gte: desde ? new Date(desde) : undefined,
        lte: hasta ? new Date(hasta) : undefined,
      },
    },
    orderBy: { fecha: "asc" },
  });

  return NextResponse.json({
    version: 1,
    metricas: metrics.map((m) => ({
      fecha: m.fecha.toISOString().slice(0, 10),
      pesoKg: m.pesoKg,
      grasaPct: m.grasaPct,
      grasaVisceral: m.grasaVisceral,
      masaMuscularKg: m.masaMuscularKg,
      cinturaCm: m.cinturaCm,
      pechoCm: m.pechoCm,
      brazoDCm: m.brazoDCm,
      musloDCm: m.musloDCm,
      cuelloCm: m.cuelloCm,
      caderaCm: m.caderaCm,
      fuente: m.fuente,
    })),
  });
}
