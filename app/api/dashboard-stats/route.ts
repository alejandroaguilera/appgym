import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";

export async function GET() {
  const atletaId = await getAthleteId();

  const [ultimaGrasa, ultimaMasaMuscular, sessions] = await Promise.all([
    prisma.bodyMetric.findFirst({
      where: { atletaId, grasaPct: { not: null } },
      orderBy: { fecha: "desc" },
      select: { fecha: true, grasaPct: true },
    }),
    prisma.bodyMetric.findFirst({
      where: { atletaId, masaMuscularKg: { not: null }, pesoKg: { not: null } },
      orderBy: { fecha: "desc" },
      select: { fecha: true, masaMuscularKg: true, pesoKg: true },
    }),
    prisma.sessionLog.findMany({
      where: { atletaId, estado: "COMPLETADA" },
      orderBy: { finalizadaEn: "asc" },
      select: {
        finalizadaEn: true,
        setLogs: {
          where: { tipo: { not: "CALENTAMIENTO" } },
          select: { pesoKg: true, reps: true, exercise: { select: { grupoMuscularPrimario: true } } },
        },
      },
    }),
  ]);

  const grasaPct = ultimaGrasa
    ? { valor: ultimaGrasa.grasaPct, fecha: ultimaGrasa.fecha }
    : null;

  const masaMuscularPct =
    ultimaMasaMuscular && ultimaMasaMuscular.pesoKg
      ? {
          valor: Math.round((ultimaMasaMuscular.masaMuscularKg! / ultimaMasaMuscular.pesoKg) * 1000) / 10,
          fecha: ultimaMasaMuscular.fecha,
        }
      : null;

  const sesionesConVolumen = sessions.map((s) => ({
    fecha: s.finalizadaEn,
    volumenKg: s.setLogs.reduce((sum, set) => sum + set.pesoKg * set.reps, 0),
  }));

  let tendencia: "subiendo" | "bajando" | "estable" | null = null;
  if (sesionesConVolumen.length >= 2) {
    const mitad = Math.floor(sesionesConVolumen.length / 2);
    const primeraMitad = sesionesConVolumen.slice(0, mitad || 1);
    const segundaMitad = sesionesConVolumen.slice(mitad || 1);
    const avg = (arr: typeof sesionesConVolumen) => arr.reduce((s, x) => s + x.volumenKg, 0) / arr.length;
    const a = avg(primeraMitad);
    const b = avg(segundaMitad.length ? segundaMitad : primeraMitad);
    const deltaPct = a > 0 ? ((b - a) / a) * 100 : 0;
    tendencia = deltaPct > 5 ? "subiendo" : deltaPct < -5 ? "bajando" : "estable";
  }

  const volumenPorGrupo = new Map<string, number>();
  for (const s of sessions) {
    for (const set of s.setLogs) {
      const grupo = set.exercise.grupoMuscularPrimario;
      volumenPorGrupo.set(grupo, (volumenPorGrupo.get(grupo) ?? 0) + set.pesoKg * set.reps);
    }
  }
  let grupoMasFuerte: { grupo: string; volumenKg: number } | null = null;
  for (const [grupo, volumenKg] of volumenPorGrupo) {
    if (!grupoMasFuerte || volumenKg > grupoMasFuerte.volumenKg) {
      grupoMasFuerte = { grupo, volumenKg };
    }
  }

  return NextResponse.json({
    grasaPct,
    masaMuscularPct,
    volumen: {
      sesiones: sesionesConVolumen.slice(-8),
      tendencia,
      suficienteData: sesionesConVolumen.length >= 2,
    },
    grupoMasFuerte,
  });
}
