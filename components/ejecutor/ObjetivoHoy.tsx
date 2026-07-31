interface ObjetivoHoyProps {
  texto: string;
}

// "Objetivo hoy" en grande (spec §4.4) — the app states the number to beat,
// the athlete never calculates it.
export function ObjetivoHoy({ texto }: ObjetivoHoyProps) {
  return (
    <div className="rounded-2xl bg-primary/10 border border-primary/30 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-primary">Objetivo hoy</div>
      <div className="text-2xl font-bold leading-tight">{texto}</div>
    </div>
  );
}
