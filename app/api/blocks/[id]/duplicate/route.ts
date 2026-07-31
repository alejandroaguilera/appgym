import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// "Duplicar bloque" — the most-used action when starting the next
// mesocycle (spec §4.3). Deep-clones templates/exercises/week overrides
// with fresh ids, resets to BORRADOR, and shifts dates by the same span so
// the new block starts right after the source's end date.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await prisma.block.findUnique({
    where: { id },
    include: {
      weekOverrides: true,
      sessionTemplates: { include: { templateExercises: true } },
    },
  });
  if (!source) return NextResponse.json({ error: "not found" }, { status: 404 });

  const spanMs = source.fechaFin.getTime() - source.fechaInicio.getTime();
  const nuevaFechaInicio = new Date(source.fechaFin.getTime() + 24 * 60 * 60 * 1000);
  const nuevaFechaFin = new Date(nuevaFechaInicio.getTime() + spanMs);

  const block = await prisma.block.create({
    data: {
      atletaId: source.atletaId,
      nombre: `${source.nombre} (copia)`,
      fechaInicio: nuevaFechaInicio,
      fechaFin: nuevaFechaFin,
      estado: "BORRADOR",
      notas: source.notas,
      weekOverrides: {
        create: source.weekOverrides.map((w) => ({
          numeroSemana: w.numeroSemana,
          deltaSeries: w.deltaSeries,
          rirObjetivo: w.rirObjetivo,
          nota: w.nota,
        })),
      },
      sessionTemplates: {
        create: source.sessionTemplates.map((st) => ({
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
