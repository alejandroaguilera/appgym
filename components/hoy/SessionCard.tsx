import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SessionCardProps {
  clave: string;
  nombre: string;
  numExercises: number;
  duracionEstimadaMin: number | null;
  numeroSemana: number | null;
  focoSemana: string | null;
  onEmpezar: () => void;
  starting: boolean;
}

export function SessionCard({
  clave,
  nombre,
  numExercises,
  duracionEstimadaMin,
  numeroSemana,
  focoSemana,
  onEmpezar,
  starting,
}: SessionCardProps) {
  return (
    <Card>
      <CardHeader>
        {numeroSemana != null && (
          <CardDescription>
            Semana {numeroSemana}
            {focoSemana ? ` · ${focoSemana}` : ""}
          </CardDescription>
        )}
        <CardTitle className="text-2xl">
          Sesión {clave} · {nombre}
        </CardTitle>
        <CardDescription>
          {numExercises} ejercicios{duracionEstimadaMin ? ` · ~${duracionEstimadaMin} min` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="xl" onClick={onEmpezar} disabled={starting}>
          {starting ? "Empezando…" : "EMPEZAR"}
        </Button>
      </CardContent>
    </Card>
  );
}
