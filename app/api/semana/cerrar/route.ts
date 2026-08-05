import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";
import { closeCycleAndOpenNext } from "@/lib/logic/week-cycle";

const cerrarSchema = z.object({ cicloId: z.string() });

// Cierra la semana y abre la siguiente. Es un paso explícito del atleta, no
// algo que ocurra solo al completar la última sesión: es el momento en que
// revisa sus resultados y se cargan los ajustes de la semana que sigue.
export async function POST(req: NextRequest) {
  const atletaId = await getAthleteId();
  const { cicloId } = cerrarSchema.parse(await req.json());

  const cycle = await prisma.weekCycle.findFirst({ where: { id: cicloId, atletaId } });
  if (!cycle) return NextResponse.json({ error: "ciclo no encontrado" }, { status: 404 });

  const siguiente = await closeCycleAndOpenNext(cycle.id);

  return NextResponse.json({ ciclo: siguiente });
}
