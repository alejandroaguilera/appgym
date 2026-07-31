"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  SessionTemplateEditor,
  newExerciseRow,
  type SessionTemplateFormState,
} from "@/components/bloques/SessionTemplateEditor";
import type { TemplateExerciseFormState } from "@/components/bloques/TemplateExerciseRow";

interface WeekOverrideFormState {
  key: string;
  numeroSemana: number;
  deltaSeries: number;
  rirObjetivo: number | null;
  nota: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BlockEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [estado, setEstado] = useState("BORRADOR");
  const [notas, setNotas] = useState("");
  const [weekOverrides, setWeekOverrides] = useState<WeekOverrideFormState[]>([]);
  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplateFormState[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/blocks/${id}`);
      const data = await res.json();
      const b = data.block;
      setNombre(b.nombre);
      setFechaInicio(b.fechaInicio.slice(0, 10));
      setFechaFin(b.fechaFin.slice(0, 10));
      setEstado(b.estado);
      setNotas(b.notas ?? "");
      setWeekOverrides(
        b.weekOverrides.map((w: { numeroSemana: number; deltaSeries: number; rirObjetivo: number | null; nota: string | null }) => ({
          key: crypto.randomUUID(),
          numeroSemana: w.numeroSemana,
          deltaSeries: w.deltaSeries,
          rirObjetivo: w.rirObjetivo,
          nota: w.nota ?? "",
        }))
      );
      setSessionTemplates(
        b.sessionTemplates.map(
          (st: {
            clave: string;
            nombre: string;
            duracionEstimadaMin: number | null;
            notas: string | null;
            templateExercises: {
              exercise: { id: string; nombre: string };
              seriesObjetivo: number;
              repsMin: number;
              repsMax: number | null;
              unidadReps: "REPS" | "SEGUNDOS";
              rirObjetivo: number | null;
              descansoSeg: number;
              notas: string | null;
              esOpcional: boolean;
              condicion: string | null;
            }[];
          }) => ({
            key: crypto.randomUUID(),
            clave: st.clave,
            nombre: st.nombre,
            duracionEstimadaMin: st.duracionEstimadaMin,
            notas: st.notas ?? "",
            templateExercises: st.templateExercises.map(
              (te): TemplateExerciseFormState => ({
                key: crypto.randomUUID(),
                exerciseId: te.exercise.id,
                exerciseNombre: te.exercise.nombre,
                seriesObjetivo: te.seriesObjetivo,
                repsMin: te.repsMin,
                repsMax: te.repsMax,
                unidadReps: te.unidadReps,
                rirObjetivo: te.rirObjetivo,
                descansoSeg: te.descansoSeg,
                notas: te.notas ?? "",
                esOpcional: te.esOpcional,
                condicion: te.condicion ?? "",
              })
            ),
          })
        )
      );
      setLoading(false);
    })();
  }, [id]);

  function addSession() {
    setSessionTemplates((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        clave: String.fromCharCode(65 + prev.length),
        nombre: "",
        duracionEstimadaMin: null,
        notas: "",
        templateExercises: [newExerciseRow()],
      },
    ]);
  }

  function addWeek() {
    setWeekOverrides((prev) => [
      ...prev,
      { key: crypto.randomUUID(), numeroSemana: prev.length + 1, deltaSeries: 0, rirObjetivo: null, nota: "" },
    ]);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      nombre,
      fechaInicio,
      fechaFin,
      estado,
      notas: notas || null,
      weekOverrides: weekOverrides.map((w) => ({
        numeroSemana: w.numeroSemana,
        deltaSeries: w.deltaSeries,
        rirObjetivo: w.rirObjetivo,
        nota: w.nota || null,
      })),
      sessionTemplates: sessionTemplates.map((st, i) => ({
        clave: st.clave,
        nombre: st.nombre,
        orden: i,
        duracionEstimadaMin: st.duracionEstimadaMin,
        notas: st.notas || null,
        templateExercises: st.templateExercises
          .filter((te) => te.exerciseId)
          .map((te, j) => ({
            exerciseId: te.exerciseId,
            orden: j,
            seriesObjetivo: te.seriesObjetivo,
            repsMin: te.repsMin,
            repsMax: te.repsMax,
            unidadReps: te.unidadReps,
            rirObjetivo: te.rirObjetivo,
            descansoSeg: te.descansoSeg,
            notas: te.notas || null,
            esOpcional: te.esOpcional,
            condicion: te.condicion || null,
          })),
      })),
    };

    const res = await fetch(`/api/blocks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      router.push("/bloques?guardado=1");
    }
  }

  if (loading) return <div className="min-h-screen bg-background" />;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 pb-24">
      <Link href="/bloques" className="text-sm text-muted underline">
        ← Bloques
      </Link>

      <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del bloque" />

      <div className="flex gap-3">
        <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
      </div>

      <div className="flex gap-2">
        {["BORRADOR", "ACTIVO", "COMPLETADO", "ARCHIVADO"].map((e) => (
          <Chip key={e} selected={estado === e} onClick={() => setEstado(e)}>
            {e}
          </Chip>
        ))}
      </div>

      <textarea
        className="rounded-xl border border-border bg-surface-raised p-3"
        placeholder="Notas del bloque..."
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={2}
      />

      <div>
        <h2 className="mb-2 font-semibold">Progresión semanal</h2>
        <div className="flex flex-col gap-2">
          {weekOverrides.map((w, i) => (
            <div key={w.key} className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised p-2">
              <span className="w-16 text-sm">Sem {w.numeroSemana}</span>
              <Input
                className="w-20"
                type="number"
                placeholder="Δ series"
                value={w.deltaSeries}
                onChange={(e) =>
                  setWeekOverrides((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, deltaSeries: Number(e.target.value) } : x))
                  )
                }
              />
              <Input
                className="w-16"
                type="number"
                placeholder="RIR"
                value={w.rirObjetivo ?? ""}
                onChange={(e) =>
                  setWeekOverrides((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, rirObjetivo: e.target.value ? Number(e.target.value) : null } : x
                    )
                  )
                }
              />
              <Input
                className="flex-1"
                placeholder="Nota"
                value={w.nota}
                onChange={(e) =>
                  setWeekOverrides((prev) => prev.map((x, j) => (j === i ? { ...x, nota: e.target.value } : x)))
                }
              />
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" className="mt-2" onClick={addWeek}>
          <Plus className="size-4" />
          Agregar semana
        </Button>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Sesiones</h2>
        <div className="flex flex-col gap-3">
          {sessionTemplates.map((st, i) => (
            <SessionTemplateEditor
              key={st.key}
              value={st}
              onChange={(v) => setSessionTemplates((prev) => prev.map((x, j) => (j === i ? v : x)))}
              onRemove={() => setSessionTemplates((prev) => prev.filter((_, j) => j !== i))}
            />
          ))}
        </div>
        <Button variant="secondary" size="sm" className="mt-3" onClick={addSession}>
          <Plus className="size-4" />
          Agregar sesión
        </Button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-4">
        <div className="mx-auto max-w-lg">
          <Button size="lg" onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Guardando…" : "Guardar bloque"}
          </Button>
        </div>
      </div>
    </div>
  );
}
