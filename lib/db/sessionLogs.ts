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

// Descartar la sesión en ejecución: borra todo rastro local en una sola
// transacción (el mismo patrón atómico de saveSessionLog) y encola un único
// DELETE. Ese DELETE entra al final del outbox y drain.ts drena en orden
// estricto de `seq`, así que gana sobre cualquier PUT pendiente de esta misma
// sesión que todavía no haya salido.
//
// Sin el borrado del sessionLog local, SessionRecoveryGate volvería a
// encontrarla con getInProgressSessionLog y rebotaría al atleta de vuelta al
// ejecutor en cuanto navegara a Hoy.
export async function discardSession(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["sessionLogs", "setLogs", "pauses", "restTimer", "sessionContext", "outbox"],
    "readwrite"
  );

  const setKeys = await tx.objectStore("setLogs").index("by-sessionLogId").getAllKeys(id);
  await Promise.all(setKeys.map((key) => tx.objectStore("setLogs").delete(key)));

  const pauseKeys = await tx.objectStore("pauses").index("by-sessionLogId").getAllKeys(id);
  await Promise.all(pauseKeys.map((key) => tx.objectStore("pauses").delete(key)));

  await tx.objectStore("restTimer").delete(id);
  await tx.objectStore("sessionContext").delete(id);
  await tx.objectStore("sessionLogs").delete(id);
  await tx.objectStore("outbox").add(newOutboxRecord("DELETE", `/api/sessions/${id}`, null));

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
