import { roundToIncrement } from "./round";

interface SetPerformance {
  pesoKg: number;
  reps: number;
  rir: number | null;
}

interface ObjetivoHoyParams {
  ultimaSesionSetsTrabajo: SetPerformance[];
  repsMin: number;
  repsMax: number | null;
  rirObjetivo: number | null;
  incrementoMinimoKg: number;
}

export interface ObjetivoHoy {
  pesoSugerido: number | null;
  repsSugeridas: number | null;
  texto: string;
}

// Doble progresión, §6.1. Evaluates the last logged session's work sets for
// this exercise against the target reps/RIR to decide whether to push
// weight or reps next.
export function calcObjetivoHoy(params: ObjetivoHoyParams): ObjetivoHoy {
  const { ultimaSesionSetsTrabajo, repsMin, repsMax, rirObjetivo, incrementoMinimoKg } = params;

  if (ultimaSesionSetsTrabajo.length === 0) {
    return {
      pesoSugerido: null,
      repsSugeridas: null,
      // Sin historial no hay peso que sugerir — y en la semana de
      // calibración eso es intencional (el plan delega la elección al
      // atleta), no un dato faltante. Decirlo explícito evita que se lea
      // como un vacío/bug.
      texto:
        rirObjetivo != null
          ? `Sin peso asignado — empieza ligero y anota lo que uses (RIR objetivo ${rirObjetivo})`
          : "Sin peso asignado — empieza ligero y anota lo que uses",
    };
  }

  const objetivoReps = repsMax ?? repsMin;
  // Redondeado por si el valor guardado trae ruido de punto flotante (p.ej.
  // una conversión desde lb) — nunca debe mostrarse un peso sin limpiar.
  const ultimoPeso = Math.round(ultimaSesionSetsTrabajo[ultimaSesionSetsTrabajo.length - 1].pesoKg * 100) / 100;

  const todasAlcanzaronObjetivo = ultimaSesionSetsTrabajo.every(
    (s) => s.reps >= objetivoReps && (rirObjetivo == null || (s.rir ?? 99) <= rirObjetivo)
  );

  if (todasAlcanzaronObjetivo) {
    const pesoSugerido = roundToIncrement(ultimoPeso * 1.05, incrementoMinimoKg);
    return {
      pesoSugerido,
      repsSugeridas: repsMin,
      texto: `Sube a ${pesoSugerido} kg × ${repsMin}`,
    };
  }

  const mejorRepsPrevia = Math.max(...ultimaSesionSetsTrabajo.map((s) => s.reps));
  const repsSugeridas = mejorRepsPrevia + 1;
  return {
    pesoSugerido: ultimoPeso,
    repsSugeridas,
    texto: `${ultimoPeso} kg × ${repsSugeridas} (una más que la vez pasada)`,
  };
}
