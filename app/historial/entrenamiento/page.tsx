"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Archive, Trophy, TrendingDown, Dumbbell } from "lucide-react";
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

interface StatsResponse {
  grupoMasFuerte: { grupo: string; volumenKg: number } | null;
  grupoOportunidad: { grupo: string; volumenKg: number } | null;
  volumen: { totalKg: number };
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export default function EntrenamientoHistorialPage() {
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  async function load() {
    const [sessionsRes, statsRes] = await Promise.all([
      fetch("/api/sessions?estado=COMPLETADA&limit=50"),
      fetch("/api/dashboard-stats"),
    ]);
    setSessions((await sessionsRes.json()).sessions);
    setStats(await statsRes.json());
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleArchivar(id: string) {
    await fetch(`/api/sessions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivada: true }),
    });
    setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 pb-24">
      <Link href="/historial" className="flex items-center gap-1 text-sm text-muted">
        <ChevronLeft className="size-4" />
        Historial
      </Link>
      <h1 className="text-lg font-bold">Entrenamiento</h1>

      {stats && (
        <div className="grid grid-cols-3 gap-2.5">
          <Card className="p-3">
            <div className="flex items-center gap-1 text-xs text-muted">
              <Trophy className="size-3.5" />
              Más fuerte
            </div>
            <div className="mt-1 text-sm font-semibold capitalize">
              {stats.grupoMasFuerte?.grupo ?? "—"}
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1 text-xs text-muted">
              <TrendingDown className="size-3.5" />
              Oportunidad
            </div>
            <div className="mt-1 text-sm font-semibold capitalize">
              {stats.grupoOportunidad?.grupo ?? "—"}
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1 text-xs text-muted">
              <Dumbbell className="size-3.5" />
              Volumen
            </div>
            <div className="mt-1 text-sm font-semibold">{Math.round(stats.volumen.totalKg)} kg</div>
          </Card>
        </div>
      )}

      {sessions === null && <p className="text-sm text-muted">Cargando…</p>}
      {sessions?.length === 0 && <p className="text-sm text-muted">Aún no hay sesiones completadas.</p>}

      <div className="flex flex-col gap-2.5">
        {sessions?.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start gap-2">
              <Link href={`/historial/entrenamiento/${s.id}`} className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    {s.sessionTemplate
                      ? `Sesión ${s.sessionTemplate.clave} · ${s.sessionTemplate.nombre}`
                      : "Sesión libre"}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{FECHA_LARGA.format(new Date(s.iniciadaEn))}</span>
                </div>
                <div className="mt-1 text-sm text-muted">
                  {s.duracionActivaSeg ? `${Math.round(s.duracionActivaSeg / 60)} min` : "—"} ·{" "}
                  {s._count.setLogs} series · {Math.round(s.volumenKg)} kg
                </div>
              </Link>
              <button
                onClick={() => handleArchivar(s.id)}
                aria-label="Archivar sesión"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted"
              >
                <Archive className="size-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
