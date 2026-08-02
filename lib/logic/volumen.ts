// Las series de calentamiento no cuentan para volumen ni PRs (spec §5.7/§6.2).
// Este where-fragment y la suma se repetían en dashboard-stats, closeSession y
// (con esta ronda) el listado de sesiones — centralizados aquí.
export const SET_NO_CALENTAMIENTO = { tipo: { not: "CALENTAMIENTO" } } as const;

export function sumVolumenKg(sets: { pesoKg: number; reps: number }[]): number {
  return sets.reduce((sum, s) => sum + s.pesoKg * s.reps, 0);
}
