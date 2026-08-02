"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SessionCard } from "@/components/hoy/SessionCard";
import { TodayMetricsQuickInput } from "@/components/hoy/WeightQuickInput";
import { DashboardStats } from "@/components/hoy/DashboardStats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { saveSessionLog } from "@/lib/db/sessionLogs";
import { saveSessionContext } from "@/lib/db/sessionContext";
import { triggerFlush } from "@/lib/sync/flush";
import type { SessionLogRecord, SessionContextRecord } from "@/lib/db/types";

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
  pesoHoyKg?: number | null;
  grasaHoyPct?: number | null;
  masaMuscularHoyKg?: number | null;
}

const HOY_FECHA = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default function HoyPage() {
  const router = useRouter();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [startingLibre, setStartingLibre] = useState(false);

  useEffect(() => {
    fetch("/api/today")
      .then((r) => r.json())
      .then(setData);
  }, []);

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

  async function saveMetric(campo: "pesoKg" | "grasaPct" | "masaMuscularKg", valor: number) {
    await fetch("/api/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: new Date().toISOString().slice(0, 10),
        [campo]: valor,
        fuente: "MANUAL",
      }),
    }).catch(() => {});
  }

  if (!data) {
    return <div className="min-h-screen bg-background" />;
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

          <DashboardStats />

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
              />
            ))}
          </div>

          <TodayMetricsQuickInput
            initialPesoKg={data.pesoHoyKg ?? null}
            initialGrasaPct={data.grasaHoyPct ?? null}
            initialMasaMuscularKg={data.masaMuscularHoyKg ?? null}
            onSavePeso={(v) => saveMetric("pesoKg", v)}
            onSaveGrasa={(v) => saveMetric("grasaPct", v)}
            onSaveMasaMuscular={(v) => saveMetric("masaMuscularKg", v)}
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
