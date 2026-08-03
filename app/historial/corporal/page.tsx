"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MetricChart } from "@/components/historial/MetricChart";
import { downloadMarkdownExport } from "@/lib/downloadMarkdown";

interface BodyMetricRow {
  fecha: string;
  pesoKg: number | null;
  grasaPct: number | null;
  masaMuscularKg: number | null;
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export default function CorporalHistorialPage() {
  const [metrics, setMetrics] = useState<BodyMetricRow[] | null>(null);
  const [editando, setEditando] = useState<BodyMetricRow | null>(null);

  async function load() {
    const desde = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    const res = await fetch(`/api/body-metrics?desde=${desde}`);
    const data = await res.json();
    setMetrics(data.metrics);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSaveEdit(pesoKg: string, grasaPct: string, masaMuscularKg: string) {
    if (!editando) return;
    const body: Record<string, unknown> = { fecha: editando.fecha.slice(0, 10), fuente: "MANUAL" };
    if (pesoKg) body.pesoKg = Number(pesoKg);
    if (grasaPct) body.grasaPct = Number(grasaPct);
    if (masaMuscularKg) body.masaMuscularKg = Number(masaMuscularKg);
    await fetch("/api/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditando(null);
    void load();
  }

  if (!metrics) return <div className="min-h-screen bg-background" />;

  const registrosConDatos = [...metrics].reverse().filter((m) => m.pesoKg != null || m.grasaPct != null || m.masaMuscularKg != null);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 pb-24">
      <Link href="/historial" className="flex items-center gap-1 text-sm text-muted">
        <ChevronLeft className="size-4" />
        Historial
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Corporal</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => downloadMarkdownExport("tipo=semanal", `resumen-semanal-${new Date().toISOString().slice(0, 10)}.md`)}
        >
          <Download className="size-4" />
          Resumen semanal
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <MetricChart
          titulo="Peso"
          etiquetaEjeY="Peso"
          unidad="kg"
          datos={metrics.map((m) => ({ fecha: m.fecha, valor: m.pesoKg }))}
        />
        <MetricChart
          titulo="Grasa corporal"
          etiquetaEjeY="% de grasa corporal"
          unidad="%"
          datos={metrics.map((m) => ({ fecha: m.fecha, valor: m.grasaPct }))}
        />
        <MetricChart
          titulo="Masa muscular"
          etiquetaEjeY="Masa muscular"
          unidad="kg"
          datos={metrics.map((m) => ({ fecha: m.fecha, valor: m.masaMuscularKg }))}
        />
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-muted">Registros</p>
        {registrosConDatos.length === 0 && <p className="text-sm text-muted">Sin registros todavía.</p>}
        {registrosConDatos.map((m) => (
          <button key={m.fecha} onClick={() => setEditando(m)} className="text-left">
            <Card className="flex items-center justify-between p-3">
              <span className="text-sm">{FECHA_LARGA.format(new Date(m.fecha))}</span>
              <div className="flex items-center gap-3 text-sm text-muted">
                {m.pesoKg != null && <span>{m.pesoKg} kg</span>}
                {m.grasaPct != null && <span>{m.grasaPct}%</span>}
                {m.masaMuscularKg != null && <span>{m.masaMuscularKg} kg músculo</span>}
                <Pencil className="size-3.5" />
              </div>
            </Card>
          </button>
        ))}
      </div>

      <EditSheet registro={editando} onClose={() => setEditando(null)} onSave={handleSaveEdit} />
    </div>
  );
}

function EditSheet({
  registro,
  onClose,
  onSave,
}: {
  registro: BodyMetricRow | null;
  onClose: () => void;
  onSave: (pesoKg: string, grasaPct: string, masaMuscularKg: string) => void;
}) {
  const [pesoKg, setPesoKg] = useState("");
  const [grasaPct, setGrasaPct] = useState("");
  const [masaMuscularKg, setMasaMuscularKg] = useState("");

  useEffect(() => {
    if (registro) {
      setPesoKg(registro.pesoKg != null ? String(registro.pesoKg) : "");
      setGrasaPct(registro.grasaPct != null ? String(registro.grasaPct) : "");
      setMasaMuscularKg(registro.masaMuscularKg != null ? String(registro.masaMuscularKg) : "");
    }
  }, [registro]);

  return (
    <Sheet
      open={registro !== null}
      onOpenChange={(open) => !open && onClose()}
      title={registro ? FECHA_LARGA.format(new Date(registro.fecha)) : ""}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Peso (kg)</span>
          <Input type="number" inputMode="decimal" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Grasa (%)</span>
          <Input type="number" inputMode="decimal" value={grasaPct} onChange={(e) => setGrasaPct(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Masa muscular (kg)</span>
          <Input
            type="number"
            inputMode="decimal"
            value={masaMuscularKg}
            onChange={(e) => setMasaMuscularKg(e.target.value)}
          />
        </label>
        <Button size="lg" onClick={() => onSave(pesoKg, grasaPct, masaMuscularKg)}>
          Guardar
        </Button>
      </div>
    </Sheet>
  );
}
