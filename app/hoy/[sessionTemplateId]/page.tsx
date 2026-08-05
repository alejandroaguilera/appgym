"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveSessionLog } from "@/lib/db/sessionLogs";
import { saveSessionContext } from "@/lib/db/sessionContext";
import { triggerFlush } from "@/lib/sync/flush";
import { useUnidadPeso } from "@/lib/context/UnidadPesoContext";
import { displayWeight, unitSuffix } from "@/lib/units";
import { formatRepsRange, formatDescanso } from "@/lib/format";
import type { SessionLogRecord, SessionContextRecord, ExerciseContext } from "@/lib/db/types";

interface TodayResponse {
  atletaId: string;
  numeroSemana?: number;
  focoSemana?: string | null;
  completedTemplateIds?: string[];
  sessionTemplate?: {
    id: string;
    clave: string;
    nombre: string;
    duracionEstimadaMin: number | null;
    numExercises: number;
  } | null;
  exercises?: ExerciseContext[];
}

interface PageProps {
  params: Promise<{ sessionTemplateId: string }>;
}

// Ver toda la rutina antes de empezar — ejercicios, prescripción y objetivo
// de cada uno — en vez de descubrirla ejercicio por ejercicio ya dentro
// del ejecutor.
export default function ResumenSesionPage({ params }: PageProps) {
  const { sessionTemplateId } = use(params);
  const router = useRouter();
  const { unidad } = useUnidadPeso();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [starting, setStarting] = useState(false);
  // Escape explícito al bloqueo: normalmente no quieres repetir una sesión que
  // ya hiciste esta semana, pero cuando de verdad la repites la app no debe
  // ser la que te lo impida.
  const [forzar, setForzar] = useState(false);

  useEffect(() => {
    fetch(`/api/today?sessionTemplateId=${sessionTemplateId}`)
      .then((r) => r.json())
      .then(setData);
  }, [sessionTemplateId]);

  const yaCompletada = data?.completedTemplateIds?.includes(sessionTemplateId) ?? false;
  const bloqueada = yaCompletada && !forzar;

  async function handleIniciar() {
    if (!data?.atletaId || !data.sessionTemplate) return;
    // La guarda vive aquí y no sólo en el render: el botón deshabilitado es
    // la señal visual, esto es lo que realmente impide crear la sesión.
    if (bloqueada) return;
    setStarting(true);
    const id = crypto.randomUUID();
    const now = new Date();

    const sessionLog: SessionLogRecord = {
      id,
      atletaId: data.atletaId,
      scheduledSessionId: null,
      sessionTemplateId: data.sessionTemplate.id,
      iniciadaEn: now,
      finalizadaEn: null,
      estado: "EN_PROGRESO",
      duracionActivaSeg: null,
      energia1a5: null,
      suenoHorasPrevias: null,
      pesoCorporalKg: null,
      notas: null,
    };
    const context: SessionContextRecord = {
      sessionLogId: id,
      sessionTemplateId: data.sessionTemplate.id,
      nombreSesion: `Sesión ${data.sessionTemplate.clave} · ${data.sessionTemplate.nombre}`,
      numeroSemana: data.numeroSemana ?? null,
      exercises: data.exercises ?? [],
    };

    await saveSessionLog(sessionLog);
    await saveSessionContext(context);
    void triggerFlush();
    router.push(`/ejecutor/${id}`);
  }

  if (!data || !data.sessionTemplate) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col p-4 pb-28">
      <Link href="/hoy" className="mb-2 flex items-center gap-1 text-sm text-muted">
        <ChevronLeft className="size-4" />
        Hoy
      </Link>

      <h1 className="text-xl font-bold">
        Sesión {data.sessionTemplate.clave} · {data.sessionTemplate.nombre}
      </h1>
      <p className="text-sm text-muted">
        {data.sessionTemplate.numExercises} ejercicios
        {data.sessionTemplate.duracionEstimadaMin ? ` · ~${data.sessionTemplate.duracionEstimadaMin} min` : ""}
        {data.numeroSemana != null ? ` · Semana ${data.numeroSemana}` : ""}
      </p>

      {yaCompletada && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-surface p-3">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm text-muted">
            Ya completaste esta sesión
            {data.numeroSemana != null ? ` en la Semana ${data.numeroSemana}` : ""}. Vuelve a estar
            disponible cuando cierres la semana.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {data.exercises?.map((ex) => (
          <div key={ex.exerciseId} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{ex.nombre}</span>
              {ex.objetivoHoy.pesoSugerido != null && (
                <span className="shrink-0 text-sm font-semibold text-primary">
                  {displayWeight(ex.objetivoHoy.pesoSugerido, unidad)}
                  {unitSuffix(unidad)}
                </span>
              )}
            </div>
            <div className="text-sm text-muted">
              {ex.seriesObjetivo} × {formatRepsRange(ex)}
              {ex.rirObjetivo != null ? ` · RIR ${ex.rirObjetivo}` : ""} · descanso{" "}
              {formatDescanso(ex.descansoSeg)}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-4">
        <div className="mx-auto max-w-lg">
          <Button size="xl" onClick={handleIniciar} disabled={starting || bloqueada}>
            {bloqueada ? "YA COMPLETADA" : starting ? "Iniciando…" : "INICIAR"}
          </Button>
          {bloqueada && (
            <button
              onClick={() => setForzar(true)}
              className="mx-auto mt-2 block text-xs text-muted underline"
            >
              Repetirla de todos modos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
