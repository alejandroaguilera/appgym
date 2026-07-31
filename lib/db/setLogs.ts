import { getDB } from "./indexeddb";
import { newOutboxRecord } from "./outbox";
import type { SetLogRecord } from "./types";

function toWire(record: SetLogRecord) {
  return { ...record, completadaEn: record.completadaEn.toISOString() };
}

export async function saveSetLog(record: SetLogRecord): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["setLogs", "outbox"], "readwrite");
  await tx.objectStore("setLogs").put(record);
  await tx
    .objectStore("outbox")
    .add(newOutboxRecord("PUT", `/api/sessions/${record.sessionLogId}/sets/${record.id}`, toWire(record)));
  await tx.done;
}

// Undo: remove locally, and if it may already have synced, enqueue a DELETE.
export async function deleteSetLog(id: string, sessionLogId: string, mayHaveSynced: boolean): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["setLogs", "outbox"], "readwrite");
  await tx.objectStore("setLogs").delete(id);
  if (mayHaveSynced) {
    await tx
      .objectStore("outbox")
      .add(newOutboxRecord("DELETE", `/api/sessions/${sessionLogId}/sets/${id}`, null));
  }
  await tx.done;
}

export async function listSetLogsForSession(sessionLogId: string): Promise<SetLogRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("setLogs", "by-sessionLogId", sessionLogId);
}
