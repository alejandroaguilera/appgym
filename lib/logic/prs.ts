export function epley1RM(pesoKg: number, reps: number): number {
  return pesoKg * (1 + reps / 30);
}

interface SetForPR {
  id: string;
  pesoKg: number;
  reps: number;
}

export interface HistoricalBests {
  pesoMax: number | null;
  e1rmMax: number | null;
  volumenMaxSesion: number | null;
  repsMaxPorPeso: Record<number, number>; // pesoKg -> best reps ever at that exact weight
}

export interface DetectedPR {
  tipo: "PESO_MAX" | "REPS_A_PESO" | "E1RM" | "VOLUMEN";
  valor: number;
  pesoKg: number | null;
  reps: number | null;
  setLogId: string | null;
  prAnteriorValor: number | null;
  estimacionBajaConfianza: boolean;
}

// §6.2. Called once per exercise (caller groups this session's non-warmup
// sets by exerciseId and passes that exercise's historical bests).
export function detectPRs(sets: SetForPR[], historical: HistoricalBests): DetectedPR[] {
  const prs: DetectedPR[] = [];
  if (sets.length === 0) return prs;

  const maxPesoSet = sets.reduce((a, b) => (b.pesoKg > a.pesoKg ? b : a));
  if (historical.pesoMax === null || maxPesoSet.pesoKg > historical.pesoMax) {
    prs.push({
      tipo: "PESO_MAX",
      valor: maxPesoSet.pesoKg,
      pesoKg: maxPesoSet.pesoKg,
      reps: maxPesoSet.reps,
      setLogId: maxPesoSet.id,
      prAnteriorValor: historical.pesoMax,
      estimacionBajaConfianza: false,
    });
  }

  let bestRepsPR: DetectedPR | null = null;
  for (const s of sets) {
    const prevBest = historical.repsMaxPorPeso[s.pesoKg] ?? 0;
    if (s.reps > prevBest && (!bestRepsPR || s.reps > (bestRepsPR.reps ?? 0))) {
      bestRepsPR = {
        tipo: "REPS_A_PESO",
        valor: s.reps,
        pesoKg: s.pesoKg,
        reps: s.reps,
        setLogId: s.id,
        prAnteriorValor: prevBest || null,
        estimacionBajaConfianza: false,
      };
    }
  }
  if (bestRepsPR) prs.push(bestRepsPR);

  const withE1rm = sets.map((s) => ({ s, e1rm: epley1RM(s.pesoKg, s.reps) }));
  const maxE1rm = withE1rm.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
  if (historical.e1rmMax === null || maxE1rm.e1rm > historical.e1rmMax) {
    prs.push({
      tipo: "E1RM",
      valor: Math.round(maxE1rm.e1rm * 100) / 100,
      pesoKg: maxE1rm.s.pesoKg,
      reps: maxE1rm.s.reps,
      setLogId: maxE1rm.s.id,
      prAnteriorValor: historical.e1rmMax,
      // §6.2: e1RM computed from sets above 12 reps loses precision.
      estimacionBajaConfianza: maxE1rm.s.reps > 12,
    });
  }

  const volumenSesion = sets.reduce((sum, s) => sum + s.pesoKg * s.reps, 0);
  if (historical.volumenMaxSesion === null || volumenSesion > historical.volumenMaxSesion) {
    prs.push({
      tipo: "VOLUMEN",
      valor: volumenSesion,
      pesoKg: null,
      reps: null,
      setLogId: null,
      prAnteriorValor: historical.volumenMaxSesion,
      estimacionBajaConfianza: false,
    });
  }

  return prs;
}
