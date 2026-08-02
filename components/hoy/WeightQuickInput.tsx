"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

interface QuickMetricFieldProps {
  label: string;
  suffix: string;
  initialValue: number | null;
  onSave: (value: number) => Promise<void>;
  className?: string;
}

// Cada campo guarda de forma independiente al perder el foco — nunca un solo
// POST combinado con los otros campos del formulario. El endpoint hace upsert
// parcial por fecha (los campos ausentes no se tocan), así que mandar los tres
// juntos arriesgaría sobrescribir uno con un valor viejo/vacío si el usuario
// solo editó otro.
function QuickMetricField({ label, suffix, initialValue, onSave, className }: QuickMetricFieldProps) {
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : "");
  const [saved, setSaved] = useState(initialValue != null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const n = Number(value);
    if (!value || Number.isNaN(n) || n <= 0) return;
    setSaving(true);
    await onSave(n);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className={className}>
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-0.5 flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="decimal"
          placeholder={suffix}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          onBlur={handleSave}
          disabled={saving}
        />
        {saved ? (
          <Check className="size-4 shrink-0 text-primary" />
        ) : (
          value && (
            <button
              onClick={handleSave}
              disabled={saving}
              aria-label={`Guardar ${label}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised"
            >
              <Check className="size-4" />
            </button>
          )
        )}
      </div>
    </div>
  );
}

interface TodayMetricsQuickInputProps {
  initialPesoKg: number | null;
  initialGrasaPct: number | null;
  initialMasaMuscularKg: number | null;
  onSavePeso: (pesoKg: number) => Promise<void>;
  onSaveGrasa: (grasaPct: number) => Promise<void>;
  onSaveMasaMuscular: (masaMuscularKg: number) => Promise<void>;
}

// Registro rápido del día (spec §4.1) — peso corporal SIEMPRE en kg, sin
// importar la preferencia de unidad de los pesos de ejercicio (decisión
// explícita del usuario: son cosas distintas).
export function TodayMetricsQuickInput({
  initialPesoKg,
  initialGrasaPct,
  initialMasaMuscularKg,
  onSavePeso,
  onSaveGrasa,
  onSaveMasaMuscular,
}: TodayMetricsQuickInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <QuickMetricField label="Peso hoy" suffix="kg" initialValue={initialPesoKg} onSave={onSavePeso} />
      <div className="grid grid-cols-2 gap-2">
        <QuickMetricField label="Grasa" suffix="%" initialValue={initialGrasaPct} onSave={onSaveGrasa} />
        <QuickMetricField
          label="Masa muscular"
          suffix="kg"
          initialValue={initialMasaMuscularKg}
          onSave={onSaveMasaMuscular}
        />
      </div>
    </div>
  );
}
