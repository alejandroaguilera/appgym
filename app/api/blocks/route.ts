import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";
import { blockSchema } from "@/lib/validation/block";

export async function GET() {
  const atletaId = await getAthleteId();
  const blocks = await prisma.block.findMany({
    where: { atletaId },
    orderBy: { fechaInicio: "desc" },
    include: { sessionTemplates: { select: { id: true } } },
  });
  return NextResponse.json({ blocks });
}

export async function POST(req: NextRequest) {
  const atletaId = await getAthleteId();
  const body = await req.json();
  const data = blockSchema.parse(body);

  const block = await prisma.block.create({
    data: {
      atletaId,
      nombre: data.nombre,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: new Date(data.fechaFin),
      estado: data.estado,
      notas: data.notas,
      weekOverrides: { create: data.weekOverrides },
      sessionTemplates: {
        create: data.sessionTemplates.map((st) => ({
          clave: st.clave,
          nombre: st.nombre,
          orden: st.orden,
          notas: st.notas,
          duracionEstimadaMin: st.duracionEstimadaMin,
          templateExercises: {
            create: st.templateExercises.map((te) => ({
              exerciseId: te.exerciseId,
              orden: te.orden,
              seriesObjetivo: te.seriesObjetivo,
              repsMin: te.repsMin,
              repsMax: te.repsMax,
              unidadReps: te.unidadReps,
              rirObjetivo: te.rirObjetivo,
              descansoSeg: te.descansoSeg,
              notas: te.notas,
              agrupacion: te.agrupacion,
              esOpcional: te.esOpcional,
              condicion: te.condicion,
            })),
          },
        })),
      },
    },
  });

  return NextResponse.json({ block });
}
