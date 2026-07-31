interface WeekOverrideLite {
  numeroSemana: number;
  deltaSeries: number;
  rirObjetivo: number | null;
  nota: string | null;
}

export function resolveWeekOverride(
  overrides: WeekOverrideLite[],
  numeroSemana: number
): WeekOverrideLite | null {
  return overrides.find((o) => o.numeroSemana === numeroSemana) ?? null;
}

export function applyWeekOverride(
  seriesObjetivo: number,
  rirObjetivoDefault: number | null,
  override: WeekOverrideLite | null
): { seriesObjetivo: number; rirObjetivo: number | null } {
  return {
    seriesObjetivo: seriesObjetivo + (override?.deltaSeries ?? 0),
    // Un rirObjetivo base nulo significa "no aplica a este ejercicio"
    // (calentamiento, planchas por tiempo) — no "usa el de la semana".
    // La progresión semanal nunca debe imponer un RIR donde el plan
    // explícitamente no puso uno.
    rirObjetivo: rirObjetivoDefault == null ? null : override?.rirObjetivo ?? rirObjetivoDefault,
  };
}
