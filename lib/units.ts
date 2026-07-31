export type UnidadPeso = "KG" | "LB";

const KG_PER_LB = 1 / 2.2046226218;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

function roundTo(value: number, nearest: number): number {
  return Math.round(value / nearest) * nearest;
}

// Storage is always kg (spec §7.1: "pesos siempre en kg, la conversión es
// solo de presentación") — these are display-boundary conversions only.
export function displayWeight(kg: number, unidad: UnidadPeso): number {
  if (unidad === "KG") return Math.round(kg * 10) / 10;
  return Math.round(kgToLb(kg) * 10) / 10;
}

export function displayStep(incrementoMinimoKg: number, unidad: UnidadPeso): number {
  if (unidad === "KG") return incrementoMinimoKg;
  return Math.max(0.5, roundTo(kgToLb(incrementoMinimoKg), 0.5));
}

export function toKg(displayValue: number, unidad: UnidadPeso): number {
  if (unidad === "KG") return displayValue;
  return lbToKg(displayValue);
}

export function unitSuffix(unidad: UnidadPeso): string {
  return unidad === "KG" ? "kg" : "lb";
}

// Server-generated "objetivo hoy" text is always phrased in kg (it's the
// calculation's source of truth). Rather than duplicating that phrasing
// logic client-side per unit, just relabel the "NN kg" tokens it contains.
export function convertWeightTextToUnit(texto: string, unidad: UnidadPeso): string {
  if (unidad === "KG") return texto;
  return texto.replace(/(\d+(?:\.\d+)?)\s*kg\b/g, (_match, num: string) => {
    return `${displayWeight(Number(num), "LB")} lb`;
  });
}
