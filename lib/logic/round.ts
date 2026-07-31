export function roundToIncrement(value: number, incrementKg: number): number {
  if (incrementKg <= 0) return value;
  return Math.round(value / incrementKg) * incrementKg;
}
