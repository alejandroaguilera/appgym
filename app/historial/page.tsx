"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, BarChart3, Trophy, TrendingDown } from "lucide-react";
import { ComingSoonCard } from "@/components/shared/ComingSoonCard";
import { Card } from "@/components/ui/card";

interface SessionListItem {
  id: string;
  iniciadaEn: string;
  finalizadaEn: string | null;
  duracionActivaSeg: number | null;
  volumenKg: number;
  _count: { setLogs: number };
  sessionTemplate: { clave: string; nombre: string } | null;
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export default function HistorialPage() {
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);

  useEffect(() => {
    fetch("/api/sessions?estado=COMPLETADA&limit=20")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions))
      .catch(() => setSessions([]));
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 pb-24">
      <h1 className="text-lg font-bold">Historial</h1>

      {sessions === null && <p className="text-sm text-muted">Cargando…</p>}

      {sessions?.length === 0 && (
        <p className="text-sm text-muted">Aún no hay sesiones completadas.</p>
      )}

      <div className="flex flex-col gap-2.5">
        {sessions?.map((s) => (
          <Link key={s.id} href={`/historial/${s.id}`}>
            <Card className="p-4 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {s.sessionTemplate ? `Sesión ${s.sessionTemplate.clave} · ${s.sessionTemplate.nombre}` : "Sesión libre"}
                </span>
                <span className="text-xs text-muted">{FECHA_LARGA.format(new Date(s.iniciadaEn))}</span>
              </div>
              <div className="mt-1 text-sm text-muted">
                {s.duracionActivaSeg ? `${Math.round(s.duracionActivaSeg / 60)} min` : "—"} ·{" "}
                {s._count.setLogs} series · {Math.round(s.volumenKg)} kg
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-2 flex flex-col gap-2.5">
        <p className="text-xs uppercase tracking-wide text-muted">Todavía no construido</p>
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
    </div>
  );
}
