"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useUnidadPeso } from "@/lib/context/UnidadPesoContext";
import { kgToLb, unitSuffix } from "@/lib/units";

export interface SessionSummary {
  duracionMin: number;
  volumenTotalKg: number;
  seriesCompletadas: number;
  seriesPlaneadas: number;
}

export interface PRSummaryItem {
  exerciseNombre: string;
  tipo: string;
  valor: number;
}

interface SessionCloseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: SessionSummary;
  prs: PRSummaryItem[] | "pending";
  closed: boolean;
  onFinalizar: (energia1a5: number | null, nota: string) => void;
  onDone: () => void;
}

const PR_LABELS: Record<string, string> = {
  PESO_MAX: "Peso máximo",
  REPS_A_PESO: "Reps a un peso",
  E1RM: "e1RM estimado",
  VOLUMEN: "Volumen de sesión",
};

// Resumen automático al cerrar (spec §4.4): duración, volumen, series,
// PRs, comparación — calculado de inmediato desde IndexedDB, nunca
// esperando a la red.
export function SessionCloseSheet({
  open,
  onOpenChange,
  summary,
  prs,
  closed,
  onFinalizar,
  onDone,
}: SessionCloseSheetProps) {
  const [energia, setEnergia] = useState<number | null>(null);
  const [nota, setNota] = useState("");
  const { unidad } = useUnidadPeso();
  const volumenDisplay =
    unidad === "LB" ? Math.round(kgToLb(summary.volumenTotalKg)) : Math.round(summary.volumenTotalKg);

  return (
    <Sheet open={open} onOpenChange={closed ? () => {} : onOpenChange} title="Cerrar sesión">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Duración" value={`${summary.duracionMin} min`} />
          <Stat label="Volumen" value={`${volumenDisplay} ${unitSuffix(unidad)}`} />
          <Stat label="Series" value={`${summary.seriesCompletadas} / ${summary.seriesPlaneadas}`} />
          <Stat
            label="PRs"
            value={prs === "pending" ? "…" : prs.length > 0 ? `${prs.length} 🎉` : "ninguno"}
          />
        </div>

        {prs !== "pending" && prs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {prs.map((pr, i) => (
              <div key={i} className="rounded-xl bg-primary/10 px-3 py-2 text-sm">
                <span className="font-semibold">{pr.exerciseNombre}</span> — {PR_LABELS[pr.tipo] ?? pr.tipo}:{" "}
                {Math.round(pr.valor * 100) / 100}
              </div>
            ))}
          </div>
        )}

        {closed ? (
          <Button size="xl" onClick={onDone}>
            Volver a Hoy
          </Button>
        ) : (
          <>
            <div>
              <span className="text-xs uppercase tracking-wide text-muted">Energía (1-5)</span>
              <div className="mt-1.5 flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Chip key={n} selected={energia === n} onClick={() => setEnergia(n)}>
                    {n}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs uppercase tracking-wide text-muted">Nota (opcional)</span>
              <textarea
                className="mt-1.5 w-full rounded-xl border border-border bg-surface-raised p-3 text-base"
                rows={2}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
            </div>

            <Button size="xl" onClick={() => onFinalizar(energia, nota.trim())}>
              Finalizar
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-raised p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
