import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";

// Limpieza única: producción quedó con 75 registros sintéticos de BodyMetric
// (fuente OMRON_CSV, generados por seedDatabase.ts como stand-in del import
// real que no existe en este entorno) mezclados con los registros reales del
// usuario. Borra solo los sintéticos — los MANUAL quedan intactos. Se borra
// este endpoint después de correrlo una vez, mismo patrón que dedupe-prs.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (token !== process.env.SEED_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const atletaId = await getAthleteId();
  const total = await prisma.bodyMetric.count({ where: { atletaId, fuente: "OMRON_CSV" } });
  const { count: borrados } = await prisma.bodyMetric.deleteMany({
    where: { atletaId, fuente: "OMRON_CSV" },
  });

  return NextResponse.json({ total, borrados });
}
