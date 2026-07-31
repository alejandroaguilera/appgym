import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";

export async function GET() {
  const atletaId = await getAthleteId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: atletaId } });
  return NextResponse.json({ unidadPeso: user.unidadPeso, nombre: user.nombre, email: user.email });
}

export async function PUT(req: NextRequest) {
  const atletaId = await getAthleteId();
  const body = await req.json();
  const unidadPeso = body.unidadPeso === "LB" ? "LB" : "KG";
  await prisma.user.update({ where: { id: atletaId }, data: { unidadPeso } });
  return NextResponse.json({ unidadPeso });
}
