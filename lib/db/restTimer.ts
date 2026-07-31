import { getDB } from "./indexeddb";
import type { RestTimerRecord } from "./types";

export async function startRestTimer(record: RestTimerRecord): Promise<void> {
  const db = await getDB();
  await db.put("restTimer", record);
}

export async function getRestTimer(sessionLogId: string): Promise<RestTimerRecord | undefined> {
  const db = await getDB();
  return db.get("restTimer", sessionLogId);
}

export async function updateRestTimer(
  sessionLogId: string,
  patch: Partial<RestTimerRecord>
): Promise<RestTimerRecord | undefined> {
  const db = await getDB();
  const current = await db.get("restTimer", sessionLogId);
  if (!current) return undefined;
  const updated = { ...current, ...patch };
  await db.put("restTimer", updated);
  return updated;
}

export async function clearRestTimer(sessionLogId: string): Promise<void> {
  const db = await getDB();
  await db.delete("restTimer", sessionLogId);
}
