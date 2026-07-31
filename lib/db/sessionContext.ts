import { getDB } from "./indexeddb";
import type { SessionContextRecord, ExerciseContext } from "./types";

// A frozen snapshot of the resolved exercise list (template + WeekOverride +
// prior performance + objetivo hoy) taken at session start. Lets a reload
// mid-session rebuild the executor UI from IndexedDB alone, with no network
// round-trip — the mechanism that makes offline resume work without the
// full app-shell precaching that's out of scope for this build.
export async function saveSessionContext(record: SessionContextRecord): Promise<void> {
  const db = await getDB();
  await db.put("sessionContext", record);
}

export async function getSessionContext(sessionLogId: string): Promise<SessionContextRecord | undefined> {
  const db = await getDB();
  return db.get("sessionContext", sessionLogId);
}

export async function updateExerciseInContext(
  sessionLogId: string,
  exerciseId: string,
  patch: Partial<ExerciseContext>
): Promise<void> {
  const db = await getDB();
  const ctx = await db.get("sessionContext", sessionLogId);
  if (!ctx) return;
  ctx.exercises = ctx.exercises.map((ex) =>
    ex.exerciseId === exerciseId ? { ...ex, ...patch } : ex
  );
  await db.put("sessionContext", ctx);
}

export async function addExerciseToContext(
  sessionLogId: string,
  exercise: ExerciseContext
): Promise<void> {
  const db = await getDB();
  const ctx = await db.get("sessionContext", sessionLogId);
  if (!ctx) return;
  ctx.exercises = [...ctx.exercises, exercise];
  await db.put("sessionContext", ctx);
}

export async function removeExerciseFromContext(
  sessionLogId: string,
  exerciseId: string
): Promise<void> {
  const db = await getDB();
  const ctx = await db.get("sessionContext", sessionLogId);
  if (!ctx) return;
  ctx.exercises = ctx.exercises.filter((ex) => ex.exerciseId !== exerciseId);
  await db.put("sessionContext", ctx);
}
