"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ExecutorHeader } from "@/components/ejecutor/ExecutorHeader";
import { AccordionExerciseItem } from "@/components/ejecutor/AccordionExerciseItem";
import { RestTimer } from "@/components/ejecutor/RestTimer";
import { MolestiaSheet } from "@/components/ejecutor/MolestiaSheet";
import { ExerciseActionsSheet } from "@/components/ejecutor/ExerciseActionsSheet";
import { SessionCloseSheet, type PRSummaryItem } from "@/components/ejecutor/SessionCloseSheet";
import { Button } from "@/components/ui/button";
import { getSessionLog, saveSessionLog, toWire as sessionToWire } from "@/lib/db/sessionLogs";
import { listSetLogsForSession, saveSetLog, deleteSetLog } from "@/lib/db/setLogs";
import { getSessionContext, saveSessionContext } from "@/lib/db/sessionContext";
import { getRestTimer, startRestTimer } from "@/lib/db/restTimer";
import { totalPausedMs, startPause, endActivePause, getActivePauseStartedAt } from "@/lib/db/pauses";
import { requestNotificationPermission } from "@/lib/notify";
import { unlockAudio } from "@/lib/audio";
import { triggerFlush } from "@/lib/sync/flush";
import { useWakeLock } from "@/lib/hooks/useWakeLock";
import type {
  SessionLogRecord,
  SetLogRecord,
  SessionContextRecord,
  RestTimerRecord,
  ExerciseContext,
} from "@/lib/db/types";

interface PageProps {
  params: Promise<{ sessionLogId: string }>;
}

function esCalentamiento(exercise: ExerciseContext): boolean {
  return exercise.notas?.toLowerCase().startsWith("calentamiento") ?? false;
}

export default function EjecutorPage({ params }: PageProps) {
  const { sessionLogId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sessionLog, setSessionLog] = useState<SessionLogRecord | null>(null);
  const [context, setContext] = useState<SessionContextRecord | null>(null);
  const [setLogs, setSetLogs] = useState<SetLogRecord[]>([]);
  const [restTimer, setRestTimer] = useState<RestTimerRecord | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [pauseStartedAtMs, setPauseStartedAtMs] = useState<number | null>(null);
  const [molestiaTargetId, setMolestiaTargetId] = useState<string | null>(null);
  const [actionsTargetId, setActionsTargetId] = useState<string | null>(null);
  const [actionsMode, setActionsMode] = useState<"menu" | "agregar">("menu");
  const [closeOpen, setCloseOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const [prs, setPrs] = useState<PRSummaryItem[] | "pending">([]);

  useWakeLock(!loading && !closed);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sl, ctx, sets, timer, pm, pauseStart] = await Promise.all([
        getSessionLog(sessionLogId),
        getSessionContext(sessionLogId),
        listSetLogsForSession(sessionLogId),
        getRestTimer(sessionLogId),
        totalPausedMs(sessionLogId),
        getActivePauseStartedAt(sessionLogId),
      ]);
      if (cancelled) return;
      if (!sl || !ctx) {
        router.replace("/hoy");
        return;
      }
      setSessionLog(sl);
      setContext(ctx);
      setSetLogs(sets);
      setRestTimer(timer ?? null);
      setPausedMs(pm);
      setPauseStartedAtMs(pauseStart);
      setLoading(false);
      void requestNotificationPermission();

      // Abre de una vez el primer ejercicio de rutina sin completar —
      // nada que tocar para empezar a registrar.
      const rutina = ctx.exercises.filter((e) => !esCalentamiento(e));
      const primeraIncompleta = rutina.find(
        (e) => sets.filter((s) => s.exerciseId === e.exerciseId).length < e.seriesObjetivo
      );
      setExpandedId((primeraIncompleta ?? rutina[0])?.exerciseId ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionLogId, router]);

  const { calentamiento, rutina } = useMemo(() => {
    const exercises = context?.exercises ?? [];
    return {
      calentamiento: exercises.filter(esCalentamiento),
      rutina: exercises.filter((e) => !esCalentamiento(e)),
    };
  }, [context]);

  const setsByExercise = useMemo(() => {
    const map = new Map<string, SetLogRecord[]>();
    for (const s of setLogs) {
      const arr = map.get(s.exerciseId) ?? [];
      arr.push(s);
      map.set(s.exerciseId, arr);
    }
    return map;
  }, [setLogs]);

  const handleConfirm = useCallback(
    async (exercise: ExerciseContext, input: { pesoKg: number; reps: number; rir: number | null }) => {
      if (!sessionLog) return;
      unlockAudio();

      const now = new Date();
      const id = crypto.randomUUID();
      const confirmedForExercise = setsByExercise.get(exercise.exerciseId) ?? [];
      const numeroSerie = confirmedForExercise.length + 1;
      const isCalentamiento = esCalentamiento(exercise);
      const record: SetLogRecord = {
        id,
        sessionLogId: sessionLog.id,
        exerciseId: exercise.exerciseId,
        numeroSerie,
        pesoKg: input.pesoKg,
        reps: input.reps,
        rir: input.rir,
        tipo: isCalentamiento ? "CALENTAMIENTO" : "TRABAJO",
        completadaEn: now,
        descansoRealSeg: null,
        notas: null,
        molestiaFlag: false,
        molestiaZona: null,
        molestiaNivel1a10: null,
        version: 1,
      };

      const lastOverall = [...setLogs].sort((a, b) => b.completadaEn.getTime() - a.completadaEn.getTime())[0];

      await saveSetLog(record);
      let nextSetLogs = [...setLogs, record];

      if (lastOverall) {
        const descansoRealSeg = Math.round((now.getTime() - lastOverall.completadaEn.getTime()) / 1000);
        const updatedLast = { ...lastOverall, descansoRealSeg };
        await saveSetLog(updatedLast);
        nextSetLogs = nextSetLogs.map((s) => (s.id === updatedLast.id ? updatedLast : s));
      }
      setSetLogs(nextSetLogs);

      if (!isCalentamiento) {
        const timer: RestTimerRecord = {
          sessionLogId: sessionLog.id,
          exerciseId: exercise.exerciseId,
          templateExerciseId: exercise.templateExerciseId,
          startedAt: Date.now(),
          durationSec: exercise.descansoSeg,
          status: "running",
        };
        await startRestTimer(timer);
        setRestTimer(timer);
      }

      void triggerFlush();
    },
    [sessionLog, setLogs, setsByExercise]
  );

  const handleSaveEdit = useCallback(
    async (id: string, patch: { pesoKg: number; reps: number; rir: number | null }) => {
      const target = setLogs.find((s) => s.id === id);
      if (!target) return;
      const updated: SetLogRecord = { ...target, ...patch, version: target.version + 1 };
      await saveSetLog(updated);
      setSetLogs((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setEditingSetId(null);
      void triggerFlush();
    },
    [setLogs]
  );

  const handleDeleteSet = useCallback(
    async (id: string) => {
      if (!sessionLog) return;
      await deleteSetLog(id, sessionLog.id, true);
      setSetLogs((prev) => prev.filter((s) => s.id !== id));
      setEditingSetId(null);
      void triggerFlush();
    },
    [sessionLog]
  );

  async function handleTogglePause() {
    if (!sessionLog) return;
    if (pauseStartedAtMs !== null) {
      await endActivePause(sessionLog.id);
      setPausedMs(await totalPausedMs(sessionLog.id));
      setPauseStartedAtMs(null);
    } else {
      await startPause(sessionLog.id);
      setPauseStartedAtMs(Date.now());
    }
  }

  async function patchExercise(exerciseId: string, patch: Partial<ExerciseContext>) {
    if (!context) return;
    const updatedExercises = context.exercises.map((e) => (e.exerciseId === exerciseId ? { ...e, ...patch } : e));
    const updatedContext = { ...context, exercises: updatedExercises };
    setContext(updatedContext);
    await saveSessionContext(updatedContext);
  }

  async function handleMolestiaSubmit(zona: string, nivel: number, nota: string) {
    if (!sessionLog) return;
    const exercise = context?.exercises.find((e) => e.exerciseId === molestiaTargetId);
    const setsForExercise = molestiaTargetId ? setsByExercise.get(molestiaTargetId) ?? [] : [];

    if (exercise && setsForExercise.length > 0) {
      const last = setsForExercise[setsForExercise.length - 1];
      const updated: SetLogRecord = {
        ...last,
        molestiaFlag: true,
        molestiaZona: zona,
        molestiaNivel1a10: nivel,
        notas: nota || last.notas,
      };
      await saveSetLog(updated);
      setSetLogs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } else {
      const notaTexto = `Molestia${exercise ? ` (${exercise.nombre})` : ""}: ${zona}, nivel ${nivel}${nota ? " — " + nota : ""}`;
      const updated: SessionLogRecord = {
        ...sessionLog,
        notas: [sessionLog.notas, notaTexto].filter(Boolean).join("\n"),
      };
      await saveSessionLog(updated);
      setSessionLog(updated);
    }
    void triggerFlush();
  }

  function handleSustituir(newExercise: { id: string; nombre: string; incrementoMinimoKg: number }) {
    if (!actionsTargetId) return;
    void patchExercise(actionsTargetId, {
      exerciseId: newExercise.id,
      nombre: newExercise.nombre,
      incrementoMinimoKg: newExercise.incrementoMinimoKg,
      objetivoHoy: { pesoSugerido: null, repsSugeridas: null, texto: "Ejercicio sustituido — sesión de calibración" },
      desempenoAnterior: [],
    });
  }

  async function handleAgregarEjercicio(newExercise: { id: string; nombre: string; incrementoMinimoKg: number }) {
    if (!context) return;
    const added: ExerciseContext = {
      templateExerciseId: null,
      exerciseId: newExercise.id,
      nombre: newExercise.nombre,
      notas: null,
      seriesObjetivo: 3,
      repsMin: 8,
      repsMax: 12,
      unidadReps: "REPS",
      rirObjetivo: null,
      descansoSeg: 90,
      incrementoMinimoKg: newExercise.incrementoMinimoKg,
      condicion: null,
      esOpcional: true,
      objetivoHoy: { pesoSugerido: null, repsSugeridas: null, texto: "Ejercicio agregado — sesión de calibración" },
      desempenoAnterior: [],
    };
    const updatedContext = { ...context, exercises: [...context.exercises, added] };
    setContext(updatedContext);
    await saveSessionContext(updatedContext);
    setExpandedId(added.exerciseId);
  }

  function handleAgregarSerie() {
    const exercise = context?.exercises.find((e) => e.exerciseId === actionsTargetId);
    if (!exercise) return;
    void patchExercise(exercise.exerciseId, { seriesObjetivo: exercise.seriesObjetivo + 1 });
  }

  function handleQuitarSerie() {
    const exercise = context?.exercises.find((e) => e.exerciseId === actionsTargetId);
    if (!exercise) return;
    void patchExercise(exercise.exerciseId, { seriesObjetivo: Math.max(0, exercise.seriesObjetivo - 1) });
  }

  const summary = useMemo(() => {
    const nonWarmup = setLogs.filter((s) => s.tipo !== "CALENTAMIENTO");
    const volumenTotalKg = nonWarmup.reduce((sum, s) => sum + s.pesoKg * s.reps, 0);
    const seriesPlaneadas = context?.exercises.reduce((sum, e) => sum + e.seriesObjetivo, 0) ?? 0;
    const startMs = sessionLog?.iniciadaEn.getTime() ?? Date.now();
    const duracionMin = Math.max(0, Math.round((Date.now() - startMs - pausedMs) / 60000));
    return {
      duracionMin,
      volumenTotalKg,
      seriesCompletadas: nonWarmup.length,
      seriesPlaneadas,
    };
  }, [setLogs, context, sessionLog, pausedMs]);

  async function handleFinalizar(energia: number | null, nota: string) {
    if (!sessionLog) return;
    const finalizadaEn = new Date();
    const duracionActivaSeg = Math.max(
      0,
      Math.round((finalizadaEn.getTime() - sessionLog.iniciadaEn.getTime() - pausedMs) / 1000)
    );
    const updated: SessionLogRecord = {
      ...sessionLog,
      estado: "COMPLETADA",
      finalizadaEn,
      duracionActivaSeg,
      energia1a5: energia,
      notas: nota ? [sessionLog.notas, nota].filter(Boolean).join("\n") : sessionLog.notas,
    };
    await saveSessionLog(updated);
    setSessionLog(updated);
    setClosed(true);
    setPrs("pending");

    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const res = await fetch(`/api/sessions/${updated.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionToWire(updated)),
        });
        if (res.ok) {
          const data = await res.json();
          const items: PRSummaryItem[] = (data.prs ?? []).map(
            (p: { exerciseId: string; tipo: string; valor: number }) => ({
              exerciseNombre:
                context?.exercises.find((e) => e.exerciseId === p.exerciseId)?.nombre ?? "Ejercicio",
              tipo: p.tipo,
              valor: p.valor,
            })
          );
          setPrs(items);
        } else {
          setPrs([]);
        }
      } catch {
        setPrs([]);
      }
    } else {
      setPrs([]);
    }

    void triggerFlush();
  }

  function openActionsFor(exerciseId: string) {
    setActionsTargetId(exerciseId);
    setActionsMode("menu");
  }

  function openAgregarEjercicio() {
    setActionsTargetId(null);
    setActionsMode("agregar");
  }

  if (loading || !context || !sessionLog) {
    return <div className="min-h-screen bg-background" />;
  }

  const totalExercises = context.exercises.length;

  if (totalExercises === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-lg font-semibold">Sesión libre</p>
        <p className="text-sm text-muted">Agrega tu primer ejercicio para empezar a registrar series.</p>
        <Button size="lg" onClick={openAgregarEjercicio}>
          Agregar ejercicio
        </Button>
        <ExerciseActionsSheet
          open={actionsMode === "agregar"}
          onOpenChange={(open) => !open && setActionsMode("menu")}
          initialMode="agregar"
          onSustituir={handleSustituir}
          onAgregarEjercicio={handleAgregarEjercicio}
          onAgregarSerie={handleAgregarSerie}
          onQuitarSerie={handleQuitarSerie}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="sticky top-0 z-20">
        <ExecutorHeader
          nombreSesion={context.nombreSesion}
          iniciadaEnMs={sessionLog.iniciadaEn.getTime()}
          pausedMs={pausedMs}
          pauseStartedAtMs={pauseStartedAtMs}
          seriesCompletadas={summary.seriesCompletadas}
          seriesPlaneadas={summary.seriesPlaneadas}
          onTogglePause={handleTogglePause}
        />
        {restTimer && restTimer.status === "running" && (
          <div className="border-b border-border bg-background p-3">
            <RestTimer sessionLogId={sessionLog.id} timer={restTimer} onChange={setRestTimer} />
          </div>
        )}
      </div>

      <div className="mx-auto flex max-w-lg flex-col gap-5 p-4">
        {calentamiento.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Calentamiento</h2>
            {calentamiento.map((ex) => (
              <AccordionExerciseItem
                key={ex.exerciseId}
                exercise={ex}
                confirmedSets={setsByExercise.get(ex.exerciseId) ?? []}
                isCalentamiento
                expanded={expandedId === ex.exerciseId}
                onToggleExpand={() => setExpandedId((cur) => (cur === ex.exerciseId ? null : ex.exerciseId))}
                editingSetId={editingSetId}
                onStartEditSet={setEditingSetId}
                onCancelEditSet={() => setEditingSetId(null)}
                onSaveEditSet={handleSaveEdit}
                onDeleteSet={handleDeleteSet}
                onConfirmSet={(input) => handleConfirm(ex, input)}
                onMolestia={() => setMolestiaTargetId(ex.exerciseId)}
                onAbrirAcciones={() => openActionsFor(ex.exerciseId)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Rutina</h2>
          {rutina.map((ex) => (
            <AccordionExerciseItem
              key={ex.exerciseId}
              exercise={ex}
              confirmedSets={setsByExercise.get(ex.exerciseId) ?? []}
              isCalentamiento={false}
              expanded={expandedId === ex.exerciseId}
              onToggleExpand={() => setExpandedId((cur) => (cur === ex.exerciseId ? null : ex.exerciseId))}
              editingSetId={editingSetId}
              onStartEditSet={setEditingSetId}
              onCancelEditSet={() => setEditingSetId(null)}
              onSaveEditSet={handleSaveEdit}
              onDeleteSet={handleDeleteSet}
              onConfirmSet={(input) => handleConfirm(ex, input)}
              onMolestia={() => setMolestiaTargetId(ex.exerciseId)}
              onAbrirAcciones={() => openActionsFor(ex.exerciseId)}
            />
          ))}

          <button
            onClick={openAgregarEjercicio}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted"
          >
            <Plus className="size-4" />
            Agregar ejercicio
          </button>
        </div>

        <Button size="lg" variant="outline" onClick={() => setCloseOpen(true)}>
          Finalizar sesión
        </Button>
      </div>

      <MolestiaSheet
        open={molestiaTargetId !== null}
        onOpenChange={(open) => !open && setMolestiaTargetId(null)}
        onSubmit={handleMolestiaSubmit}
      />

      <ExerciseActionsSheet
        open={actionsTargetId !== null || actionsMode === "agregar"}
        onOpenChange={(open) => {
          if (!open) {
            setActionsTargetId(null);
            setActionsMode("menu");
          }
        }}
        initialMode={actionsMode}
        onSustituir={handleSustituir}
        onAgregarEjercicio={handleAgregarEjercicio}
        onAgregarSerie={handleAgregarSerie}
        onQuitarSerie={handleQuitarSerie}
      />

      <SessionCloseSheet
        open={closeOpen}
        onOpenChange={setCloseOpen}
        summary={summary}
        prs={prs}
        closed={closed}
        onFinalizar={handleFinalizar}
        onDone={() => router.replace("/hoy")}
      />
    </div>
  );
}
