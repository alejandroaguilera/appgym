interface SetPerformance {
  pesoKg: number;
  reps: number;
  rir: number | null;
}

interface DesempenoAnteriorProps {
  sets: SetPerformance[];
}

// Always visible without having to search for it (spec §4.4).
export function DesempenoAnterior({ sets }: DesempenoAnteriorProps) {
  if (sets.length === 0) {
    return <p className="text-sm text-muted">Sin historial todavía para este ejercicio.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 text-sm text-muted">
      <span className="text-xs uppercase tracking-wide">Sesión anterior:</span>
      {sets.map((s, i) => (
        <span key={i} className="rounded-full bg-surface-raised px-2.5 py-1">
          {s.pesoKg}kg×{s.reps}
          {s.rir != null ? ` @${s.rir}` : ""}
        </span>
      ))}
    </div>
  );
}
