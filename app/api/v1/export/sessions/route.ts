import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExportToken } from "@/lib/exportAuth";
import { sumVolumenKg } from "@/lib/logic/volumen";

export async function GET(req: NextRequest) {
  const auth = await requireExportToken(req);
  if (typeof auth !== "string") return auth;
  const atletaId = auth;

  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");

  const sessions = await prisma.sessionLog.findMany({
    where: {
      atletaId,
      estado: "COMPLETADA",
      archivadaEn: null,
      finalizadaEn: {
        gte: desde ? new Date(desde) : undefined,
        lte: hasta ? new Date(hasta) : undefined,
      },
    },
    orderBy: { finalizadaEn: "asc" },
    include: {
      setLogs: {
        orderBy: [{ exerciseId: "asc" }, { numeroSerie: "asc" }],
        include: { exercise: { select: { nombre: true, grupoMuscularPrimario: true } } },
      },
    },
  });

  return NextResponse.json({
    version: 1,
    sesiones: sessions.map((s) => ({
      id: s.id,
      iniciadaEn: s.iniciadaEn.toISOString(),
      finalizadaEn: s.finalizadaEn?.toISOString() ?? null,
      duracionActivaSeg: s.duracionActivaSeg,
      energia1a5: s.energia1a5,
      suenoHorasPrevias: s.suenoHorasPrevias,
      notas: s.notas,
      volumenKg: sumVolumenKg(s.setLogs.filter((set) => set.tipo !== "CALENTAMIENTO")),
      series: s.setLogs.map((set) => ({
        ejercicio: set.exercise.nombre,
        grupoMuscularPrimario: set.exercise.grupoMuscularPrimario,
        numeroSerie: set.numeroSerie,
        pesoKg: set.pesoKg,
        reps: set.reps,
        rir: set.rir,
        tipo: set.tipo,
        esPr: set.esPr,
      })),
    })),
  });
}
