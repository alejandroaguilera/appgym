import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

interface SessionCardProps {
  id: string;
  clave: string;
  nombre: string;
  numExercises: number;
  duracionEstimadaMin: number | null;
  sugerida: boolean;
}

// Las 4 sesiones se ven todas de una vez — nada de paginar entre A/B/C/D
// detrás de un switcher. Cada una lleva al resumen antes de ejecutar.
export function SessionCard({ id, clave, nombre, numExercises, duracionEstimadaMin, sugerida }: SessionCardProps) {
  return (
    <Link href={`/hoy/${id}`}>
      <Card
        className={
          sugerida
            ? "border-primary/50 bg-primary/5 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
            : "transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
        }
      >
        <div className="flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-lg font-bold">
            {clave}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{nombre}</span>
              {sugerida && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                  Hoy toca
                </span>
              )}
            </div>
            <span className="text-sm text-muted">
              {numExercises} ejercicios{duracionEstimadaMin ? ` · ~${duracionEstimadaMin} min` : ""}
            </span>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted" />
        </div>
      </Card>
    </Link>
  );
}
