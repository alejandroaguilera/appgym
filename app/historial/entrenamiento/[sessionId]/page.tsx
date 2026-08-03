"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Archive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sumVolumenKg } from "@/lib/logic/volumen";

interface SetLogItem {
  id: string;
  exerciseId: string;
  numeroSerie: number;
  pesoKg: number;
  reps: number;
  rir: number | null;
  tipo: string;
  esPr: boolean;
  exercise: { nombre: string; grupoMuscularPrimario: string };
}

interface SessionDetail {
  id: string;
  iniciadaEn: string;
  finalizadaEn: string | null;
  duracionActivaSeg: number | null;
  energia1a5: number | null;
  notas: string | null;
  setLogs: SetLogItem[];
}

interface DetailResponse {
  session: SessionDetail;
  sessionTemplate: { clave: string; nombre: string } | null;
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function HistorialDetallePage({ params }: PageProps) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [archivando, setArchivando] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [sessionId]);

  async function handleArchivar() {
    setArchivando(true);
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivada: true }),
    });
    router.push("/historial/entrenamiento");
  }

  if (!data) return <div className="min-h-screen bg-background" />;

  const { session, sessionTemplate } = data;
  const trabajo = session.setLogs.filter((s) => s.tipo !== "CALENTAMIENTO");
  const calentamiento = session.setLogs.filter((s) => s.tipo === "CALENTAMIENTO");
  const volumenTotal = sumVolumenKg(trabajo);

  const porEjercicio = new Map<string, SetLogItem[]>();
  for (const s of session.setLogs) {
    const arr = porEjercicio.get(s.exerciseId) ?? [];
    arr.push(s);
    porEjercicio.set(s.exerciseId, arr);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 pb-24">
      <Link href="/historial/entrenamiento" className="flex items-center gap-1 text-sm text-muted">
        <ChevronLeft className="size-4" />
        Entrenamiento
      </Link>

      <div>
        <h1 className="text-xl font-bold">
          {sessionTemplate ? `Sesión ${sessionTemplate.clave} · ${sessionTemplate.nombre}` : "Sesión libre"}
        </h1>
        <p className="text-sm text-muted capitalize">{FECHA_LARGA.format(new Date(session.iniciadaEn))}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Card className="p-3 text-center">
          <div className="text-lg font-semibold">
            {session.duracionActivaSeg ? Math.round(session.duracionActivaSeg / 60) : "—"}
          </div>
          <div className="text-xs text-muted">min</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-lg font-semibold">{Math.round(volumenTotal)}</div>
          <div className="text-xs text-muted">kg volumen</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-lg font-semibold">{trabajo.length}</div>
          <div className="text-xs text-muted">series</div>
        </Card>
      </div>

      {session.energia1a5 != null && (
        <p className="text-sm text-muted">Energía: {session.energia1a5}/5</p>
      )}
      {session.notas && <p className="text-sm text-muted">Nota: {session.notas}</p>}

      <div className="flex flex-col gap-2">
        {[...porEjercicio.entries()].map(([exerciseId, sets]) => (
          <Card key={exerciseId} className="p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{sets[0].exercise.nombre}</span>
              <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] capitalize text-muted">
                {sets[0].exercise.grupoMuscularPrimario}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {sets.map((s) => (
                <span
                  key={s.id}
                  className="flex items-center gap-1 rounded-full bg-surface-raised px-2.5 py-1 text-sm tabular-nums"
                >
                  {s.pesoKg}kg×{s.reps}
                  {s.rir != null && <span className="text-xs text-muted">@{s.rir}</span>}
                  {s.tipo === "CALENTAMIENTO" && <span className="text-xs text-muted">(calent.)</span>}
                  {s.esPr && <span className="text-warning">★</span>}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {calentamiento.length > 0 && (
        <p className="text-xs text-muted">
          {calentamiento.length} serie{calentamiento.length === 1 ? "" : "s"} de calentamiento no incluida
          {calentamiento.length === 1 ? "" : "s"} en el volumen.
        </p>
      )}

      <Button variant="outline" onClick={handleArchivar} disabled={archivando}>
        <Archive className="size-4" />
        {archivando ? "Archivando…" : "Archivar esta sesión"}
      </Button>
    </div>
  );
}
