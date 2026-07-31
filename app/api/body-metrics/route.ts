import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";
import { bodyMetricSchema } from "@/lib/validation/bodyMetric";

export async function GET(req: NextRequest) {
  const atletaId = await getAthleteId();
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
  return NextResponse.json({ metrics });
}

export async function POST(req: NextRequest) {
  const atletaId = await getAthleteId();
  const body = await req.json();
  const data = bodyMetricSchema.parse(body);

  const metric = await prisma.bodyMetric.upsert({
    where: { atletaId_fecha: { atletaId, fecha: new Date(data.fecha) } },
    create: { atletaId, ...data, fecha: new Date(data.fecha) },
    update: { ...data, fecha: new Date(data.fecha) },
  });

  return NextResponse.json({ metric });
}
