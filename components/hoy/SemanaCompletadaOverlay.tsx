"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FireworksCanvas } from "@/components/hoy/FireworksCanvas";
import { useUnidadPeso } from "@/lib/context/UnidadPesoContext";
import { kgToLb, unitSuffix } from "@/lib/units";
import type { WeekSummary } from "@/lib/logic/week-summary";

interface SemanaCompletadaOverlayProps {
  mensaje: string;
  resumen: WeekSummary;
  resumenMarkdown: string;
  cerrando: boolean;
  onCerrarSemana: () => void;
}

// No se descarta tocando fuera ni con Escape, a diferencia de los sheets: la
// semana no avanza sola. Este overlay ES el paso de cierre — el momento en que
// el atleta revisa sus resultados antes de que arranque la semana siguiente.
export function SemanaCompletadaOverlay({
  mensaje,
  resumen,
  resumenMarkdown,
  cerrando,
  onCerrarSemana,
}: SemanaCompletadaOverlayProps) {
  const { unidad } = useUnidadPeso();
  const [copiado, setCopiado] = useState(false);

  const volumen =
    unidad === "LB" ? Math.round(kgToLb(resumen.volumenTotalKg)) : resumen.volumenTotalKg;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resumenMarkdown);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer desde aquí; el
      // resumen sigue disponible en el export de la semana.
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Semana ${resumen.numeroSemana} completa`}
      className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-sm"
    >
      <FireworksCanvas />

      <div className="relative mx-auto flex min-h-full max-w-lg flex-col justify-center gap-5 p-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">
            {resumen.sesionesCompletadas} de {resumen.sesionesPlaneadas} sesiones
          </p>
          <h1 className="mt-1 text-3xl font-bold">¡Semana {resumen.numeroSemana} completa!</h1>
        </div>

        <p className="text-center text-lg leading-snug text-foreground">{mensaje}</p>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Volumen" value={`${volumen.toLocaleString("es-MX")} ${unitSuffix(unidad)}`} />
          <Stat
            label="vs. semana previa"
            value={
              resumen.deltaVolumenPct != null
                ? `${resumen.deltaVolumenPct >= 0 ? "+" : ""}${resumen.deltaVolumenPct}%`
                : "—"
            }
          />
          <Stat label="Series" value={`${resumen.seriesTotales}`} />
          <Stat
            label="PRs"
            value={resumen.prs.length > 0 ? `${resumen.prs.length} 🎉` : "ninguno"}
          />
        </div>

        {resumen.grupoTop && (
          <p className="text-center text-sm text-muted">
            Grupo con más volumen: <span className="capitalize text-foreground">{resumen.grupoTop.grupo}</span>
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button size="xl" onClick={onCerrarSemana} disabled={cerrando}>
            {cerrando ? "Cerrando…" : `Cerrar y empezar la Semana ${resumen.numeroSemana + 1}`}
          </Button>
          <button
            onClick={copiar}
            className="flex items-center justify-center gap-1.5 py-2 text-sm text-muted underline"
          >
            {copiado ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
            {copiado ? "Resumen copiado" : "Copiar resumen para el coach"}
          </button>
        </div>
      </div>
    </div>
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
