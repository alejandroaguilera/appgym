"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Dumbbell, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";

interface SessionPreview {
  id: string;
  iniciadaEn: string;
  volumenKg: number;
  sessionTemplate: { clave: string; nombre: string } | null;
}

interface BodyMetricPreview {
  fecha: string;
  pesoKg: number | null;
}

const FECHA_CORTA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

export default function HistorialPage() {
  const [sesiones, setSesiones] = useState<SessionPreview[] | null>(null);
  const [metricas, setMetricas] = useState<BodyMetricPreview[] | null>(null);

  useEffect(() => {
    fetch("/api/sessions?estado=COMPLETADA&limit=2")
      .then((r) => r.json())
      .then((d) => setSesiones(d.sessions))
      .catch(() => setSesiones([]));

    const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    fetch(`/api/body-metrics?desde=${desde}`)
      .then((r) => r.json())
      .then((d) => setMetricas((d.metrics as BodyMetricPreview[]).slice(-2).reverse()))
      .catch(() => setMetricas([]));
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 pb-24">
      <h1 className="text-lg font-bold">Historial</h1>

      <Link href="/historial/entrenamiento">
        <Card className="p-4 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell className="size-4 text-primary" />
              <span className="font-semibold">Entrenamiento</span>
            </div>
            <ChevronRight className="size-5 text-muted" />
          </div>
          {sesiones === null ? (
            <p className="mt-2 text-sm text-muted">Cargando…</p>
          ) : sesiones.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aún no hay sesiones completadas.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {sesiones.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm text-muted">
                  <span>
                    {s.sessionTemplate ? `Sesión ${s.sessionTemplate.clave}` : "Sesión libre"} ·{" "}
                    {FECHA_CORTA.format(new Date(s.iniciadaEn))}
                  </span>
                  <span className="tabular-nums">{Math.round(s.volumenKg)} kg</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Link>

      <Link href="/historial/corporal">
        <Card className="p-4 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="size-4 text-primary" />
              <span className="font-semibold">Corporal</span>
            </div>
            <ChevronRight className="size-5 text-muted" />
          </div>
          {metricas === null ? (
            <p className="mt-2 text-sm text-muted">Cargando…</p>
          ) : metricas.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aún no hay registros recientes.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {metricas.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm text-muted">
                  <span>{FECHA_CORTA.format(new Date(m.fecha))}</span>
                  <span className="tabular-nums">{m.pesoKg != null ? `${m.pesoKg} kg` : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Link>
    </div>
  );
}
