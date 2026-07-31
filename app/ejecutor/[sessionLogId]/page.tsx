"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ExecutorHeader } from "@/components/ejecutor/ExecutorHeader";
import { ExerciseHeader } from "@/components/ejecutor/ExerciseHeader";
import { ExerciseBody } from "@/components/ejecutor/ExerciseBody";
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
  TipoSet,
} from "@/lib/db/types";

interface PageProps {
  params: Promise<{ sessionLogId: string }>;
}

interface InputState {
  pesoKg: number;
  reps: number;
  rir: number | null;
  tipo: TipoSet;
}

export default function EjecutorPage({ params }: PageProps) {
  const { sessionLogId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sessionLog, setSessionLog] = useState<SessionLogRecord | null>(null);
  const [context, setContext] = useState<SessionContextRecord | null>(null);
  const [setLogs, setSetLogs] = useState<SetLogRecord[]>([]);
  const [restTimer, setRestTimer] = useState<RestTimerRecord | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState<InputState>({ pesoKg: 0, reps: 0, rir: null, tipo: "TRABAJO" });
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [pauseStartedAtMs, setPauseStartedAtMs] = useState<number | null>(null);
  const [molestiaOpen, setMolestiaOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
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
      // Ask once, on entering the executor — the SW notification that
      // marks the end of a rest period (§5.5) is a no-op without this.
      void requestNotificationPermission();
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionLogId, router]);

  const exercise = context?.exercises[currentIndex] ?? null;

  const confirmedSetsForExercise = useMemo(
    () => (exercise ? setLogs.filter((s) => s.exerciseId === exercise.exerciseId) : []),
    [setLogs, exercise]
  );

  // Prefill the next-set input from what was just confirmed for this
  // exercise, else the objetivo hoy suggestion — "casi siempre correcto,
  // evita teclear" (spec §4.4).
  useEffect(() => {
    if (!exercise) return;
    const last = confirmedSetsForExercise[confirmedSetsForExercise.length - 1];
    if (last) {
      setInput({ pesoKg: last.pesoKg, reps: last.reps, rir: last.rir, tipo: "TRABAJO" });
    } else {
      setInput({
        pesoKg: exercise.objetivoHoy.pesoSugerido ?? 0,
        reps: exercise.objetivoHoy.repsSugeridas ?? exercise.repsMin,
        rir: exercise.rirObjetivo,
        tipo: "TRABAJO",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const handleConfirm = useCallback(async () => {
    if (!sessionLog || !exercise) return;
    unlockAudio();

    const now = new Date();
    const id = crypto.randomUUID();
    const numeroSerie = confirmedSetsForExercise.length + 1;
    const record: SetLogRecord = {
      id,
      sessionLogId: sessionLog.id,
      exerciseId: exercise.exerciseId,
      numeroSerie,
      pesoKg: input.pesoKg,
      reps: input.reps,
      rir: input.rir,
      tipo: input.tipo,
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

    if (input.tipo !== "CALENTAMIENTO") {
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
  }, [sessionLog, exercise, input, setLogs, confirmedSetsForExercise]);

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

  async function patchCurrentExercise(patch: Partial<ExerciseContext>) {
    if (!context) return;
    const updatedExercises = context.exercises.map((e, i) => (i === currentIndex ? { ...e, ...patch } : e));
    const updatedContext = { ...context, exercises: updatedExercises };
    setContext(updatedContext);
    await saveSessionContext(updatedContext);
  }

  async function handleMolestiaSubmit(zona: string, nivel: number, nota: string) {
    if (!exercise || !sessionLog) return;
    if (confirmedSetsForExercise.length > 0) {
      const last = confirmedSetsForExercise[confirmedSetsForExercise.length - 1];
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
      const notaTexto = `Molestia (${exercise.nombre}): ${zona}, nivel ${nivel}${nota ? " — " + nota : ""}`;
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
    void patchCurrentExercise({
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
  }

  function handleAgregarSerie() {
    if (!exercise) return;
    void patchCurrentExercise({ seriesObjetivo: exercise.seriesObjetivo + 1 });
  }

  function handleQuitarSerie() {
    if (!exercise) return;
    void patchCurrentExercise({ seriesObjetivo: Math.max(0, exercise.seriesObjetivo - 1) });
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

  if (loading || !context || !sessionLog) {
    return <div className="min-h-screen bg-background" />;
  }

  const exerciseCount = context.exercises.length;

  if (exerciseCount === 0 || !exercise) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-lg font-semibold">Sesión libre</p>
        <p className="text-sm text-muted">Agrega tu primer ejercicio para empezar a registrar series.</p>
        <Button size="lg" onClick={() => setActionsOpen(true)}>
          Agregar ejercicio
        </Button>
        <ExerciseActionsSheet
          open={actionsOpen}
          onOpenChange={setActionsOpen}
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
      <ExecutorHeader
        nombreSesion={context.nombreSesion}
        iniciadaEnMs={sessionLog.iniciadaEn.getTime()}
        pausedMs={pausedMs}
        pauseStartedAtMs={pauseStartedAtMs}
        exerciseIndex={currentIndex}
        exerciseCount={exerciseCount}
        onTogglePause={handleTogglePause}
      />

      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
        <ExerciseHeader exercise={exercise} onAbrirAcciones={() => setActionsOpen(true)} />

        {restTimer && restTimer.status === "running" && (
          <RestTimer sessionLogId={sessionLog.id} timer={restTimer} onChange={setRestTimer} />
        )}

        <ExerciseBody
          exercise={exercise}
          confirmedSets={confirmedSetsForExercise}
          editingSetId={editingSetId}
          onStartEdit={setEditingSetId}
          onCancelEdit={() => setEditingSetId(null)}
          onSaveEdit={handleSaveEdit}
          onDeleteSet={handleDeleteSet}
          input={input}
          onInputChange={(patch) => setInput((prev) => ({ ...prev, ...patch }))}
          onConfirm={handleConfirm}
          onMolestia={() => setMolestiaOpen(true)}
        />

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="size-5" />
            Anterior
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={currentIndex >= exerciseCount - 1}
            onClick={() => setCurrentIndex((i) => Math.min(exerciseCount - 1, i + 1))}
          >
            Siguiente
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <Button size="lg" variant="outline" onClick={() => setCloseOpen(true)}>
          Finalizar sesión
        </Button>
      </div>

      <MolestiaSheet open={molestiaOpen} onOpenChange={setMolestiaOpen} onSubmit={handleMolestiaSubmit} />

      <ExerciseActionsSheet
        open={actionsOpen}
        onOpenChange={setActionsOpen}
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
