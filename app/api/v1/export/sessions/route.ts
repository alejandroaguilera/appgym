import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExportToken } from "@/lib/exportAuth";
import { localDateRangeBounds } from "@/lib/date";
import { sumVolumenKg } from "@/lib/logic/volumen";

export async function GET(req: NextRequest) {
  const auth = await requireExportToken(req);
  if (typeof auth !== "string") return auth;
  const atletaId = auth;

  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");

  // El rango se aplica sobre `iniciadaEn`, no sobre `finalizadaEn`: es el campo
  // que este payload expone como fecha de la sesión, y es NOT NULL — filtrar
  // por una columna nullable deja fuera en silencio cualquier sesión
  // COMPLETADA que llegue sin cierre (sendBeacon/outbox).
  const sessions = await prisma.sessionLog.findMany({
    where: {
      atletaId,
      estado: "COMPLETADA",
      archivadaEn: null,
      iniciadaEn: localDateRangeBounds(desde, hasta),
    },
    orderBy: { iniciadaEn: "asc" },
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
