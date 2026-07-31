import { getDB } from "./indexeddb";

export async function startPause(sessionLogId: string): Promise<void> {
  const db = await getDB();
  await db.add("pauses", { sessionLogId, pausedAt: Date.now(), resumedAt: null });
}

export async function endActivePause(sessionLogId: string): Promise<void> {
  const db = await getDB();
  const all = await db.getAllFromIndex("pauses", "by-sessionLogId", sessionLogId);
  const active = all.find((p) => p.resumedAt === null);
  if (!active || active.seq === undefined) return;
  await db.put("pauses", { ...active, resumedAt: Date.now() });
}

export async function totalPausedMs(sessionLogId: string): Promise<number> {
  const db = await getDB();
  const all = await db.getAllFromIndex("pauses", "by-sessionLogId", sessionLogId);
  const now = Date.now();
  return all.reduce((sum, p) => sum + ((p.resumedAt ?? now) - p.pausedAt), 0);
}

export async function isPaused(sessionLogId: string): Promise<boolean> {
  const db = await getDB();
  const all = await db.getAllFromIndex("pauses", "by-sessionLogId", sessionLogId);
  return all.some((p) => p.resumedAt === null);
}

export async function getActivePauseStartedAt(sessionLogId: string): Promise<number | null> {
  const db = await getDB();
  const all = await db.getAllFromIndex("pauses", "by-sessionLogId", sessionLogId);
  const active = all.find((p) => p.resumedAt === null);
  return active ? active.pausedAt : null;
}
