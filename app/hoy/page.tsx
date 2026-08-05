"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SessionCard } from "@/components/hoy/SessionCard";
import { SemanaCompletadaOverlay } from "@/components/hoy/SemanaCompletadaOverlay";
import { BodyMetricsCard } from "@/components/hoy/BodyMetricsCard";
import { DashboardStats } from "@/components/hoy/DashboardStats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { saveSessionLog } from "@/lib/db/sessionLogs";
import { saveSessionContext } from "@/lib/db/sessionContext";
import { triggerFlush } from "@/lib/sync/flush";
import { localDayString } from "@/lib/date";
import type { SessionLogRecord, SessionContextRecord } from "@/lib/db/types";
import type { WeekSummary } from "@/lib/logic/week-summary";

interface TodayResponse {
  atletaId: string;
  block: { id: string; nombre: string } | null;
  numeroSemana?: number;
  focoSemana?: string | null;
  sugeridaId?: string;
  sessionTemplates?: {
    id: string;
    clave: string;
    nombre: string;
    numExercises: number;
    duracionEstimadaMin: number | null;
  }[];
  completedTemplateIds?: string[];
  semana?: {
    cicloId: string;
    numeroSemana: number;
    completada: boolean;
    celebradaEn: string | null;
  };
  metricasCorporales?: {
    pesoKg: number | null;
    grasaPct: number | null;
    masaMuscularKg: number | null;
    actualizadoEn: string | null;
    esDeHoy: boolean;
  };
}

const HOY_FECHA = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

interface Celebracion {
  mensaje: string;
  resumen: WeekSummary;
  resumenMarkdown: string;
  cicloId: string;
}

export default function HoyPage() {
  const router = useRouter();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [startingLibre, setStartingLibre] = useState(false);
  const [celebracion, setCelebracion] = useState<Celebracion | null>(null);
  const [cerrandoSemana, setCerrandoSemana] = useState(false);

  const loadToday = useCallback(async () => {
    const r = await fetch("/api/today");
    const json: TodayResponse = await r.json();
    setData(json);
    return json;
  }, []);

  useEffect(() => {
    void loadToday();

    // El estado de completado se calcula en el servidor a partir de filas que
    // llegan por el outbox. Si al montar todavía no habían drenado, sin este
    // refetch el tachado no aparecería hasta una recarga manual — que es
    // exactamente como se siente un caché rancio.
    const recargar = () => {
      if (document.visibilityState === "visible") void loadToday();
    };
    document.addEventListener("visibilitychange", recargar);
    window.addEventListener("online", recargar);
    return () => {
      document.removeEventListener("visibilitychange", recargar);
      window.removeEventListener("online", recargar);
    };
  }, [loadToday]);

  // La celebración se pide una sola vez por ciclo: el mensaje queda cacheado en
  // el servidor, así que este POST es idempotente y no vuelve a llamar a Grok.
  useEffect(() => {
    const semana = data?.semana;
    if (!semana?.completada || semana.celebradaEn || celebracion) return;

    let cancelled = false;
    (async () => {
      const res = await fetch("/api/semana/celebracion", { method: "POST" }).catch(() => null);
      if (!res?.ok || cancelled) return;
      const json = await res.json();
      setCelebracion({
        mensaje: json.mensaje,
        resumen: json.resumen,
        resumenMarkdown: json.resumenMarkdown,
        cicloId: json.cicloId,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.semana, celebracion]);

  async function handleCerrarSemana() {
    if (!celebracion) return;
    setCerrandoSemana(true);
    await fetch("/api/semana/cerrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cicloId: celebracion.cicloId }),
    }).catch(() => {});
    setCelebracion(null);
    await loadToday();
    setCerrandoSemana(false);
  }

  async function handleSesionLibre() {
    if (!data?.atletaId) return;
    setStartingLibre(true);
    const id = crypto.randomUUID();
    const now = new Date();

    const sessionLog: SessionLogRecord = {
      id,
      atletaId: data.atletaId,
      scheduledSessionId: null,
      sessionTemplateId: null,
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
      sessionTemplateId: null,
      nombreSesion: "Sesión libre",
      numeroSemana: null,
      exercises: [],
    };

    await saveSessionLog(sessionLog);
    await saveSessionContext(context);
    void triggerFlush();
    router.push(`/ejecutor/${id}`);
  }

  async function saveMetricas(valores: { pesoKg?: number; grasaPct?: number; masaMuscularKg?: number }) {
    await fetch("/api/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: localDayString(),
        ...valores,
        fuente: "MANUAL",
      }),
    }).catch(() => {});
    await loadToday();
  }

  if (!data) {
    return <div className="min-h-screen bg-background" />;
  }

  if (celebracion) {
    return (
      <SemanaCompletadaOverlay
        mensaje={celebracion.mensaje}
        resumen={celebracion.resumen}
        resumenMarkdown={celebracion.resumenMarkdown}
        cerrando={cerrandoSemana}
        onCerrarSemana={handleCerrarSemana}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 pb-24">
      <div>
        <h1 className="text-lg font-bold">Hoy</h1>
        <p className="text-sm capitalize text-muted">{HOY_FECHA.format(new Date())}</p>
      </div>

      {!data.block ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin bloque activo</CardTitle>
            <CardDescription>Crea un bloque para ver tu sesión de hoy.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/bloques" className="text-primary underline">
              Ir a Bloques →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {data.numeroSemana != null && (
            <p className="text-sm text-muted">
              Semana {data.numeroSemana}
              {data.focoSemana ? ` · ${data.focoSemana}` : ""}
            </p>
          )}

          <h2 className="text-xs uppercase tracking-wide text-muted">Estadísticas</h2>

          <DashboardStats />

          <h2 className="text-xs uppercase tracking-wide text-muted">Entrenamientos</h2>

          <div className="flex flex-col gap-2.5">
            {data.sessionTemplates?.map((t) => (
              <SessionCard
                key={t.id}
                id={t.id}
                clave={t.clave}
                nombre={t.nombre}
                numExercises={t.numExercises}
                duracionEstimadaMin={t.duracionEstimadaMin}
                sugerida={t.id === data.sugeridaId}
                completado={data.completedTemplateIds?.includes(t.id) ?? false}
              />
            ))}
          </div>

          <BodyMetricsCard
            pesoKg={data.metricasCorporales?.pesoKg ?? null}
            grasaPct={data.metricasCorporales?.grasaPct ?? null}
            masaMuscularKg={data.metricasCorporales?.masaMuscularKg ?? null}
            actualizadoEn={data.metricasCorporales?.actualizadoEn ?? null}
            onSave={saveMetricas}
          />

          <button
            onClick={handleSesionLibre}
            disabled={startingLibre}
            className="text-sm text-muted underline disabled:opacity-50"
          >
            {startingLibre ? "Empezando…" : "O empieza una sesión libre →"}
          </button>
        </>
      )}
    </div>
  );
}
