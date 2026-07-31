"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface WeightQuickInputProps {
  initialValue: number | null;
  onSave: (pesoKg: number) => Promise<void>;
}

// Peso de hoy: un input inline de un solo toque (spec §4.1).
export function WeightQuickInput({ initialValue, onSave }: WeightQuickInputProps) {
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : "");
  const [saved, setSaved] = useState(initialValue != null);
  const [saving, setSaving] = useState(false);

  async function handleBlurOrSave() {
    const n = Number(value);
    if (!value || Number.isNaN(n) || n <= 0) return;
    setSaving(true);
    await onSave(n);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">Peso hoy:</span>
      <Input
        type="number"
        inputMode="decimal"
        placeholder="kg"
        className="w-24"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={handleBlurOrSave}
      />
      {!saved && value && (
        <Button size="sm" variant="secondary" onClick={handleBlurOrSave} disabled={saving}>
          Guardar
        </Button>
      )}
      {saved && <span className="text-xs text-primary">✓</span>}
    </div>
  );
}
