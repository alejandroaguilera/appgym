"use client";

import { useEffect, useState } from "react";
import { Flame, Dumbbell, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatsResponse {
  grasaPct: { valor: number; fecha: string } | null;
  masaMuscularPct: { valor: number; fecha: string } | null;
  volumen: {
    sesiones: { fecha: string; volumenKg: number }[];
    tendencia: "subiendo" | "bajando" | "estable" | null;
    suficienteData: boolean;
  };
  grupoMasFuerte: { grupo: string; volumenKg: number } | null;
}

// Sparkline mínimo: línea de 2px en el tono de énfasis, sin ejes ni grid —
// a esta escala (un stat tile) la forma de la tendencia es todo lo que
// importa (spec de dataviz: "12-point sparkline in the de-emphasis hue,
// current period in the accent").
function Sparkline({ values }: { values: number[] }) {
  const w = 100;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const last = points[points.length - 1].split(",").map(Number);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none">
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

  useEffect(() => {
    fetch("/api/dashboard-stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const TendenciaIcon = stats.volumen.tendencia ? TENDENCIA_ICON[stats.volumen.tendencia] : Minus;

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
        value={stats.masaMuscularPct ? `${stats.masaMuscularPct.valor}%` : "—"}
        sub={!stats.masaMuscularPct ? "Sin datos aún" : undefined}
      />

      <Card className="col-span-2 p-3">
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
            <Sparkline values={stats.volumen.sesiones.map((s) => s.volumenKg)} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Necesitas al menos 2 sesiones cerradas para ver la tendencia.
          </p>
        )}
      </Card>

      <Card className="col-span-2 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Trophy className="size-3.5" />
          Área muscular más entrenada
        </div>
        <div className="mt-1 text-lg font-semibold capitalize">
          {stats.grupoMasFuerte ? stats.grupoMasFuerte.grupo : "Sin datos aún"}
        </div>
      </Card>
    </div>
  );
}
