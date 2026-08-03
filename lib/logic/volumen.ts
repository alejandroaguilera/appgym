// Las series de calentamiento no cuentan para volumen ni PRs (spec §5.7/§6.2).
// Este where-fragment y la suma se repetían en dashboard-stats, closeSession y
// (con esta ronda) el listado de sesiones — centralizados aquí.
export const SET_NO_CALENTAMIENTO = { tipo: { not: "CALENTAMIENTO" } } as const;

export function sumVolumenKg(sets: { pesoKg: number; reps: number }[]): number {
  return sets.reduce((sum, s) => sum + s.pesoKg * s.reps, 0);
}

interface SetConGrupo {
  pesoKg: number;
  reps: number;
  exercise: { grupoMuscularPrimario: string };
}

// Compartido por dashboard-stats (histórico total) y el resumen de
// historial/entrenamiento (mismo cálculo, mismo alcance histórico total) —
// antes vivía duplicado como un loop inline en la ruta de dashboard-stats.
export function computeVolumenPorGrupo(sets: SetConGrupo[]): Map<string, number> {
  const volumenPorGrupo = new Map<string, number>();
  for (const s of sets) {
    const grupo = s.exercise.grupoMuscularPrimario;
    volumenPorGrupo.set(grupo, (volumenPorGrupo.get(grupo) ?? 0) + s.pesoKg * s.reps);
  }
  return volumenPorGrupo;
}

export interface GrupoVolumen {
  grupo: string;
  volumenKg: number;
}

// Grupo con más (o, invertido, menos) volumen entre los que YA tienen al
// menos una serie registrada — no puede detectar grupos nunca entrenados
// (haría falta cruzar contra el catálogo completo de familias musculares).
export function pickGrupoExtremo(
  volumenPorGrupo: Map<string, number>,
  tipo: "max" | "min"
): GrupoVolumen | null {
  let resultado: GrupoVolumen | null = null;
  for (const [grupo, volumenKg] of volumenPorGrupo) {
    const mejor =
      !resultado || (tipo === "max" ? volumenKg > resultado.volumenKg : volumenKg < resultado.volumenKg);
    if (mejor) resultado = { grupo, volumenKg };
  }
  return resultado;
}
