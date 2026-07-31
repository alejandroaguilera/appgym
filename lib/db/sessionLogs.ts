import { getDB } from "./indexeddb";
import { newOutboxRecord } from "./outbox";
import type { SessionLogRecord } from "./types";

export function toWire(record: SessionLogRecord) {
  return {
    ...record,
    iniciadaEn: record.iniciadaEn.toISOString(),
    finalizadaEn: record.finalizadaEn ? record.finalizadaEn.toISOString() : null,
  };
}

// Writes the SessionLog locally AND enqueues its sync event in one atomic
// IndexedDB transaction — an entity change never exists without a matching
// outbox record. This is the actual durability guarantee, not the network.
export async function saveSessionLog(record: SessionLogRecord): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessionLogs", "outbox"], "readwrite");
  await tx.objectStore("sessionLogs").put(record);
  await tx
    .objectStore("outbox")
    .add(newOutboxRecord("PUT", `/api/sessions/${record.id}`, toWire(record)));
  await tx.done;
}

export async function getSessionLog(id: string): Promise<SessionLogRecord | undefined> {
  const db = await getDB();
  return db.get("sessionLogs", id);
}

export async function getInProgressSessionLog(): Promise<SessionLogRecord | undefined> {
  const db = await getDB();
  const all = await db.getAllFromIndex("sessionLogs", "by-estado", "EN_PROGRESO");
  return all[0];
}

export async function listSessionLogs(): Promise<SessionLogRecord[]> {
  const db = await getDB();
  return db.getAll("sessionLogs");
}
