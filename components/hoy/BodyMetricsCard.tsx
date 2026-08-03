"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BodyMetricsCardProps {
  pesoKg: number | null;
  grasaPct: number | null;
  masaMuscularKg: number | null;
  actualizadoEn: string | null;
  onSave: (valores: { pesoKg?: number; grasaPct?: number; masaMuscularKg?: number }) => Promise<void>;
}

const ACTUALIZADO_FORMATO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

interface FieldState {
  value: string;
  dirty: boolean;
}

function toFieldState(value: number | null): FieldState {
  return { value: value != null ? String(value) : "", dirty: false };
}

// Los 3 campos son de solo-lectura hasta que se toca "Editar" — evita el
// autoguardado silencioso de antes. "Guardar" solo manda al servidor los
// campos que el usuario tocó en esta sesión de edición: si hoy no tenía
// registro, los 3 campos se prellenan con el más reciente disponible solo
// como referencia, y no queremos escribir esos valores viejos como si fueran
// de hoy si el usuario solo editó uno.
export function BodyMetricsCard({
  pesoKg,
  grasaPct,
  masaMuscularKg,
  actualizadoEn,
  onSave,
}: BodyMetricsCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [peso, setPeso] = useState<FieldState>(() => toFieldState(pesoKg));
  const [grasa, setGrasa] = useState<FieldState>(() => toFieldState(grasaPct));
  const [masa, setMasa] = useState<FieldState>(() => toFieldState(masaMuscularKg));

  useEffect(() => {
    if (!editing) {
      setPeso(toFieldState(pesoKg));
      setGrasa(toFieldState(grasaPct));
      setMasa(toFieldState(masaMuscularKg));
    }
  }, [pesoKg, grasaPct, masaMuscularKg, editing]);

  async function handleButtonClick() {
    if (!editing) {
      setEditing(true);
      return;
    }

    const valores: { pesoKg?: number; grasaPct?: number; masaMuscularKg?: number } = {};
    if (peso.dirty && peso.value) valores.pesoKg = Number(peso.value);
    if (grasa.dirty && grasa.value) valores.grasaPct = Number(grasa.value);
    if (masa.dirty && masa.value) valores.masaMuscularKg = Number(masa.value);

    if (Object.keys(valores).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    await onSave(valores);
    setSaving(false);
    setEditing(false);
  }

  const actualizadoTexto = actualizadoEn
    ? `Última actualización ${ACTUALIZADO_FORMATO.format(new Date(actualizadoEn))}`
    : "Sin registros aún";

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-xs uppercase tracking-wide text-muted">Métricas corporales</h2>
        <p className="text-xs text-muted">{actualizadoTexto}</p>
      </div>

      <div className="flex flex-col gap-2">
        <MetricField
          label="Peso hoy"
          suffix="kg"
          state={peso}
          disabled={!editing}
          onChange={(value) => setPeso({ value, dirty: true })}
        />
        <div className="grid grid-cols-2 gap-2">
          <MetricField
            label="Grasa"
            suffix="%"
            state={grasa}
            disabled={!editing}
            onChange={(value) => setGrasa({ value, dirty: true })}
          />
          <MetricField
            label="Masa muscular"
            suffix="kg"
            state={masa}
            disabled={!editing}
            onChange={(value) => setMasa({ value, dirty: true })}
          />
        </div>
      </div>

      <Button variant="secondary" size="sm" disabled={saving} onClick={handleButtonClick}>
        {saving ? "Guardando…" : editing ? "Guardar" : "Editar"}
      </Button>
    </div>
  );
}

function MetricField({
  label,
  suffix,
  state,
  disabled,
  onChange,
}: {
  label: string;
  suffix: string;
  state: FieldState;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <span className="text-xs text-muted">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        placeholder={suffix}
        value={state.value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5"
      />
    </div>
  );
}
