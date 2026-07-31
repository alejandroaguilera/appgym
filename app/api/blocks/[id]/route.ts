import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blockSchema } from "@/lib/validation/block";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const block = await prisma.block.findUnique({
    where: { id },
    include: {
      weekOverrides: { orderBy: { numeroSemana: "asc" } },
      sessionTemplates: {
        orderBy: { orden: "asc" },
        include: { templateExercises: { orderBy: { orden: "asc" }, include: { exercise: true } } },
      },
    },
  });
  if (!block) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ block });
}

// Whole-block save: the editor screen submits the full nested tree in one
// shot, so we replace sessionTemplates/templateExercises/weekOverrides
// wholesale in a transaction rather than diffing field-by-field. SetLog/
// SessionLog history references sessionTemplateId as a plain (non-FK)
// string, so past logs are unaffected by re-editing or reordering a block.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data = blockSchema.parse(body);

  const block = await prisma.$transaction(async (tx) => {
    await tx.weekOverride.deleteMany({ where: { blockId: id } });
    await tx.sessionTemplate.deleteMany({ where: { blockId: id } });

    return tx.block.update({
      where: { id },
      data: {
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
  });

  return NextResponse.json({ block });
}
