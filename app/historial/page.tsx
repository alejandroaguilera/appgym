import { LineChart, BarChart3, Trophy, TrendingDown } from "lucide-react";
import { ComingSoonCard } from "@/components/shared/ComingSoonCard";

export default function HistorialPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 pb-24">
      <h1 className="text-lg font-bold">Historial</h1>
      <p className="text-sm text-muted">
        Esta sección crece en la fase 5 del roadmap. Por ahora, tus sesiones y series ya se están
        guardando — cuando esto se construya, va a leer justo de ahí.
      </p>

      <ComingSoonCard
        icon={LineChart}
        title="Progreso por ejercicio"
        description="Peso, reps, e1RM estimado y volumen a lo largo del tiempo, por ejercicio."
      />
      <ComingSoonCard
        icon={BarChart3}
        title="Volumen semanal por grupo muscular"
        description="Series efectivas vs. rangos de referencia (mantenimiento, hipertrofia, rezagado)."
      />
      <ComingSoonCard
        icon={Trophy}
        title="Feed de PRs"
        description="Peso máximo, e1RM, volumen — ya se detectan al cerrar sesión, falta el feed."
      />
      <ComingSoonCard
        icon={TrendingDown}
        title="Estancamiento y regresión"
        description="Ejercicios sin progreso en 3+ sesiones, marcados automáticamente."
      />
    </div>
  );
}
