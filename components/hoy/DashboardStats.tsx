"use client";

import { useEffect, useState } from "react";
import { Flame, Dumbbell, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";

interface StatsResponse {
  grasaPct: { valor: number; fecha: string } | null;
  masaMuscularKg: { valor: number; fecha: string } | null;
  volumen: {
    sesiones: { fecha: string; volumenKg: number }[];
    tendencia: "subiendo" | "bajando" | "estable" | null;
    suficienteData: boolean;
  };
  grupoMasFuerte: { grupo: string; volumenKg: number } | null;
}

const FECHA_CORTA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

// Sparkline mínimo: línea de 2px en el tono de énfasis, sin ejes ni grid —
// a esta escala (un stat tile) la forma de la tendencia es todo lo que
// importa (spec de dataviz: "12-point sparkline in the de-emphasis hue,
// current period in the accent"). Exportado para reusarse, más grande, en
// el sheet de detalle.
export function Sparkline({ values, height = 28 }: { values: number[]; height?: number }) {
  const w = 100;
  const h = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = values.length > 1 ? (i / (values.length - 1)) * w : w / 2;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const last = points[points.length - 1].split(",").map(Number);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

const TENDENCIA_ICON = { subiendo: TrendingUp, bajando: TrendingDown, estable: Minus };
const TENDENCIA_LABEL = { subiendo: "subiendo", bajando: "bajando", estable: "estable" };

export function DashboardStats() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard-stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const TendenciaIcon = stats.volumen.tendencia ? TENDENCIA_ICON[stats.volumen.tendencia] : Minus;
  const sesionesCompacto = stats.volumen.sesiones.slice(-8);

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatTile
        icon={Flame}
        label="Grasa corporal"
        value={stats.grasaPct ? `${stats.grasaPct.valor}%` : "—"}
        sub={!stats.grasaPct ? "Sin datos aún" : undefined}
      />
      <StatTile
        icon={Dumbbell}
        label="Masa muscular"
        value={stats.masaMuscularKg ? `${stats.masaMuscularKg.valor} kg` : "—"}
        sub={!stats.masaMuscularKg ? "Sin datos aún" : undefined}
      />

      <button
        type="button"
        onClick={() => stats.volumen.suficienteData && setDetalleOpen(true)}
        className="col-span-2 text-left"
      >
        <Card className="p-3 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]">
          <div className="flex items-center justify-between gap-1.5 text-xs text-muted">
            <span>Volumen total por sesión</span>
            {stats.volumen.tendencia && (
              <span className="flex items-center gap-1">
                <TendenciaIcon className="size-3.5" />
                {TENDENCIA_LABEL[stats.volumen.tendencia]}
              </span>
            )}
          </div>
          {stats.volumen.suficienteData ? (
            <div className="mt-2">
              <Sparkline values={sesionesCompacto.map((s) => s.volumenKg)} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Necesitas al menos 2 sesiones cerradas para ver la tendencia.
            </p>
          )}
        </Card>
      </button>

      <Card className="col-span-2 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Trophy className="size-3.5" />
          Área muscular más entrenada
        </div>
        <div className="mt-1 text-lg font-semibold capitalize">
          {stats.grupoMasFuerte ? stats.grupoMasFuerte.grupo : "Sin datos aún"}
        </div>
      </Card>

      <Sheet open={detalleOpen} onOpenChange={setDetalleOpen} title="Volumen por sesión">
        <div className="flex flex-col gap-4">
          <Sparkline values={stats.volumen.sesiones.map((s) => s.volumenKg)} height={80} />
          <div className="flex flex-col divide-y divide-border">
            {[...stats.volumen.sesiones].reverse().map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted">{FECHA_CORTA.format(new Date(s.fecha))}</span>
                <span className="font-semibold tabular-nums">{Math.round(s.volumenKg)} kg</span>
              </div>
            ))}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
