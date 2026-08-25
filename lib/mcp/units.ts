import { kgToLb, lbToKg } from "@/lib/units";
import { roundToIncrement } from "@/lib/logic/round";

// Frontera de unidades del MCP (SPEC §5, "Convenciones de carga").
//
// La base guarda kg; el gym de Alejandro está rotulado en libras y es la
// unidad en la que él lee y ejecuta. Todo peso de gimnasio entra y sale de
// estas herramientas en libras para que el coach prescriba el número que va a
// ver en el rack. Las métricas corporales NO pasan por aquí: siguen en kg.
//
// Todos los pesos son TOTALES, nunca por lado: "50 lb" en curl de mancuernas
// es 2 × 25 lb. El schema no distingue, así que la convención vive en la
// descripción de cada herramienta y en este comentario.

// Una décima de libra es la resolución con la que se muestra el peso en la
// app (displayWeight); redondear aquí evita devolver 44.09999999999999.
export function kgALb(kg: number): number {
  return Math.round(kgToLb(kg) * 10) / 10;
}

export function lbAKg(lb: number): number {
  return Math.round(lbToKg(lb) * 100) / 100;
}

// Una prescripción tiene que ser ejecutable: si el incremento mínimo del
// ejercicio es 2.5 kg, pedir 47 lb (21.3 kg) es pedir un peso que no existe en
// el rack. Se redondea en kg —donde vive el incremento— y se reporta el peso
// realmente aplicado para que el coach vea lo que quedó, no lo que pidió.
export function ajustarAIncremento(lb: number, incrementoMinimoKg: number): {
  pesoKg: number;
  pesoLb: number;
  ajustado: boolean;
} {
  const pedidoKg = lbAKg(lb);
  const pesoKg = Math.round(roundToIncrement(pedidoKg, incrementoMinimoKg) * 100) / 100;
  return { pesoKg, pesoLb: kgALb(pesoKg), ajustado: pesoKg !== pedidoKg };
}
