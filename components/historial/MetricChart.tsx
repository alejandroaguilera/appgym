"use client";

import { useMemo, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

export type RangoTiempo = "semana" | "mes" | "año";

const RANGO_DIAS: Record<RangoTiempo, number> = { semana: 7, mes: 30, año: 365 };
const RANGO_LABEL: Record<RangoTiempo, string> = { semana: "Semana", mes: "Mes", año: "Año" };
const RANGO_FORMATO: Record<RangoTiempo, Intl.DateTimeFormat> = {
  semana: new Intl.DateTimeFormat("es-MX", { weekday: "short" }),
  mes: new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }),
  año: new Intl.DateTimeFormat("es-MX", { month: "short" }),
};

interface MetricChartProps {
  titulo: string;
  etiquetaEjeY: string;
  unidad: string;
  // Dataset completo (hasta 1 año) ya traído por el padre — cada gráfica
  // recorta y filtra su propio campo, sin volver a pedir al servidor cada
  // vez que cambia el rango.
  datos: { fecha: string; valor: number | null }[];
}

const W = 300;
const H = 160;
const PAD_L = 34;
const PAD_B = 28;
const PAD_T = 10;
const PAD_R = 10;

export function MetricChart({ titulo, etiquetaEjeY, unidad, datos }: MetricChartProps) {
  const [rango, setRango] = useState<RangoTiempo>("mes");
  const [activo, setActivo] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const puntos = useMemo(() => {
    const desde = Date.now() - RANGO_DIAS[rango] * 86_400_000;
    return datos
      .filter((d) => d.valor != null && new Date(d.fecha).getTime() >= desde)
      .map((d) => ({ fecha: new Date(d.fecha), valor: d.valor as number }))
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [datos, rango]);

  if (puntos.length === 0) {
    return (
      <Card className="p-3">
        <div className="text-sm font-semibold">{titulo}</div>
        <p className="mt-2 text-sm text-muted">Sin datos en este rango todavía.</p>
        <RangoButtons rango={rango} setRango={setRango} />
      </Card>
    );
  }

  const min = Math.min(...puntos.map((p) => p.valor));
  const max = Math.max(...puntos.map((p) => p.valor));
  const range = max - min || 1;
  const t0 = puntos[0].fecha.getTime();
  const t1 = puntos[puntos.length - 1].fecha.getTime() || t0 + 1;

  const xFor = (t: number) => {
    const frac = puntos.length > 1 ? (t - t0) / (t1 - t0 || 1) : 0.5;
    return PAD_L + frac * (W - PAD_L - PAD_R);
  };
  const yFor = (v: number) => PAD_T + (1 - (v - min) / range) * (H - PAD_T - PAD_B);

  const linePoints = puntos.map((p) => `${xFor(p.fecha.getTime())},${yFor(p.valor)}`).join(" ");
  const areaPoints = `${xFor(t0)},${H - PAD_B} ${linePoints} ${xFor(t1)},${H - PAD_B}`;

  function handlePointer(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    puntos.forEach((p, i) => {
      const d = Math.abs(xFor(p.fecha.getTime()) - x);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setActivo(nearest);
  }

  const puntoActivo = activo != null ? puntos[activo] : puntos[puntos.length - 1];
  const fmt = RANGO_FORMATO[rango];

  return (
    <Card className="p-3">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold">{titulo}</div>
        <div className="text-lg font-bold tabular-nums">
          {puntoActivo.valor}
          {unidad}
          <span className="ml-1.5 text-xs font-normal text-muted">{fmt.format(puntoActivo.fecha)}</span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full touch-none"
        onPointerDown={(e) => handlePointer(e.clientX)}
        onPointerMove={(e) => e.buttons === 1 && handlePointer(e.clientX)}
      >
        {/* Eje Y: línea hairline + rótulo del nombre de la métrica, rotado */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="var(--border)" strokeWidth={1} />
        <text
          x={10}
          y={H / 2}
          transform={`rotate(-90, 10, ${H / 2})`}
          textAnchor="middle"
          fontSize={8}
          fill="var(--muted)"
        >
          {etiquetaEjeY}
        </text>
        <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end" fontSize={8} fill="var(--muted)">
          {Math.round(max)}
        </text>
        <text x={PAD_L - 4} y={H - PAD_B} textAnchor="end" fontSize={8} fill="var(--muted)">
          {Math.round(min)}
        </text>

        {/* Eje X: línea hairline + rótulo literal del rango */}
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--border)" strokeWidth={1} />
        <text x={(PAD_L + W - PAD_R) / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--muted)">
          {RANGO_LABEL[rango]}
        </text>

        {/* Área + línea */}
        <polygon points={areaPoints} fill="var(--primary)" opacity={0.1} stroke="none" />
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Crosshair + punto activo */}
        {activo != null && (
          <line
            x1={xFor(puntoActivo.fecha.getTime())}
            y1={PAD_T}
            x2={xFor(puntoActivo.fecha.getTime())}
            y2={H - PAD_B}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
        <circle
          cx={xFor(puntoActivo.fecha.getTime())}
          cy={yFor(puntoActivo.valor)}
          r={3.5}
          fill="var(--primary)"
          stroke="var(--surface)"
          strokeWidth={2}
        />
      </svg>

      <RangoButtons rango={rango} setRango={setRango} />
    </Card>
  );
}

function RangoButtons({ rango, setRango }: { rango: RangoTiempo; setRango: (r: RangoTiempo) => void }) {
  return (
    <div className="mt-2 flex gap-1.5">
      {(["semana", "mes", "año"] as const).map((r) => (
        <Chip key={r} selected={rango === r} onClick={() => setRango(r)} className="!h-8 !px-3 text-xs">
          {RANGO_LABEL[r]}
        </Chip>
      ))}
    </div>
  );
}
