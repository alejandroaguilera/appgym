"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SessionCard } from "@/components/hoy/SessionCard";
import { WeightQuickInput } from "@/components/hoy/WeightQuickInput";
import { SessionSwitcher } from "@/components/hoy/SessionSwitcher";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { saveSessionLog } from "@/lib/db/sessionLogs";
import { saveSessionContext } from "@/lib/db/sessionContext";
import { triggerFlush } from "@/lib/sync/flush";
import type { SessionLogRecord, SessionContextRecord, ExerciseContext } from "@/lib/db/types";

interface TodayResponse {
  atletaId: string;
  block: { id: string; nombre: string } | null;
  numeroSemana?: number;
  focoSemana?: string | null;
  sessionTemplates?: { id: string; clave: string; nombre: string }[];
  sessionTemplate?: {
    id: string;
    clave: string;
    nombre: string;
    duracionEstimadaMin: number | null;
    numExercises: number;
  } | null;
  exercises?: ExerciseContext[];
  pesoHoyKg?: number | null;
}

export default function HoyPage() {
  const router = useRouter();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [starting, setStarting] = useState(false);

  async function load(sessionTemplateId?: string) {
    const url = sessionTemplateId ? `/api/today?sessionTemplateId=${sessionTemplateId}` : "/api/today";
    const res = await fetch(url);
    const json = await res.json();
    setData(json);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleEmpezar(sessionLibre: boolean) {
    if (!data?.atletaId) return;
    setStarting(true);
    const id = crypto.randomUUID();
    const now = new Date();

    const sessionLog: SessionLogRecord = {
      id,
      atletaId: data.atletaId,
      scheduledSessionId: null,
      sessionTemplateId: sessionLibre ? null : data.sessionTemplate?.id ?? null,
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
      sessionTemplateId: sessionLibre ? null : data.sessionTemplate?.id ?? null,
      nombreSesion: sessionLibre
        ? "Sesión libre"
        : `Sesión ${data.sessionTemplate?.clave} · ${data.sessionTemplate?.nombre}`,
      numeroSemana: sessionLibre ? null : data.numeroSemana ?? null,
      exercises: sessionLibre ? [] : data.exercises ?? [],
    };

    await saveSessionLog(sessionLog);
    await saveSessionContext(context);
    void triggerFlush();

    router.push(`/ejecutor/${id}`);
  }

  async function handleSaveWeight(pesoKg: number) {
    await fetch("/api/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), pesoKg, fuente: "MANUAL" }),
    }).catch(() => {});
  }

  if (!data) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Hoy</h1>
        <Link href="/bloques" className="text-sm text-muted underline">
          Bloques
        </Link>
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
      ) : data.sessionTemplate ? (
        <>
          <SessionCard
            clave={data.sessionTemplate.clave}
            nombre={data.sessionTemplate.nombre}
            numExercises={data.sessionTemplate.numExercises}
            duracionEstimadaMin={data.sessionTemplate.duracionEstimadaMin}
            numeroSemana={data.numeroSemana ?? null}
            focoSemana={data.focoSemana ?? null}
            onEmpezar={() => handleEmpezar(false)}
            starting={starting}
          />

          <WeightQuickInput initialValue={data.pesoHoyKg ?? null} onSave={handleSaveWeight} />

          {data.sessionTemplates && (
            <SessionSwitcher
              templates={data.sessionTemplates}
              selectedId={data.sessionTemplate.id}
              onSelect={(id) => void load(id)}
              onSesionLibre={() => handleEmpezar(true)}
            />
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sin sesiones en este bloque</CardTitle>
            <CardDescription>Agrega sesiones A/B/C/D al bloque activo.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
