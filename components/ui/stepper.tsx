"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  label: string;
  value: number;
  step: number;
  min?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  className?: string;
}

// Steppers + direct numeric entry (spec §4.4), large enough to hit reliably
// mid-set. The number itself is a native numeric input so a precise value
// can still be typed directly. Buttons are shrink-0 and the input is
// min-w-0 so two of these side by side compress instead of overflowing
// the card on narrower phones.
export function Stepper({
  label,
  value,
  step,
  min = 0,
  onChange,
  formatValue,
  className,
}: StepperProps) {
  const clamp = (v: number) => Math.max(min, Math.round(v * 100) / 100);

  // From a converted weight (e.g. 44.1 lb) +/− should land on a plate
  // multiple (45 / 40), not keep dragging the leftover decimal.
  const stepBy = (direction: 1 | -1) => {
    if (step <= 0) return clamp(value + direction);
    const next =
      direction === 1
        ? Math.floor(value / step + 1e-9) * step + step
        : Math.ceil(value / step - 1e-9) * step - step;
    return clamp(next);
  };

  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-1", className)}>
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <div className="flex w-full min-w-0 items-center gap-1.5">
        <button
          type="button"
          aria-label={`Restar ${label}`}
          onClick={() => onChange(stepBy(-1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised active:bg-border"
        >
          <Minus className="size-5" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(clamp(n));
          }}
          className="w-full min-w-0 rounded-xl border border-border bg-surface-raised py-2 text-center text-2xl font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="button"
          aria-label={`Sumar ${label}`}
          onClick={() => onChange(stepBy(1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised active:bg-border"
        >
          <Plus className="size-5" />
        </button>
      </div>
      {formatValue && <span className="text-xs text-muted">{formatValue(value)}</span>}
    </div>
  );
}
