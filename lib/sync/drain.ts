import { listOutbox, removeOutboxRecord, markOutboxAttempt } from "@/lib/db/outbox";
import { notifySyncStatusChanged } from "./client";

let draining = false;

function backoffMs(intentos: number): number {
  const base = Math.min(30_000 * 2 ** intentos, 5 * 60_000);
  const jitter = base * (0.8 + Math.random() * 0.4);
  return jitter;
}

// Drains the outbox strictly in `seq` order. Stops the whole pass on a
// transient failure (offline / 5xx) rather than skipping ahead — this is
// what guarantees a SessionLog PUT always reaches the server before its
// SetLog PUTs, since they were enqueued in that order, with no separate
// dependency graph needed. A permanent 4xx is skipped (not silently
// dropped) so it can't wedge the queue forever.
export async function drainOutbox(): Promise<void> {
  if (draining) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  draining = true;
  try {
    const records = await listOutbox();
    const now = Date.now();
    for (const record of records) {
      if (record.seq === undefined) continue;
      if (record.permanentError) continue;
      if (record.nextAttemptAt > now) break;

      try {
        const res = await fetch(record.url, {
          method: record.method,
          headers: record.body ? { "Content-Type": "application/json" } : undefined,
          body: record.body ? JSON.stringify(record.body) : undefined,
        });

        if (res.ok) {
          await removeOutboxRecord(record.seq);
          continue;
        }

        if (res.status >= 400 && res.status < 500) {
          await markOutboxAttempt(record.seq, {
            permanentError: `HTTP ${res.status}`,
          });
          continue; // don't wedge the queue on a real bug; keep processing
        }

        // 5xx: transient, stop the pass and retry later with backoff.
        await markOutboxAttempt(record.seq, {
          intentos: record.intentos + 1,
          nextAttemptAt: Date.now() + backoffMs(record.intentos + 1),
        });
        break;
      } catch {
        // Network failure: transient, stop the pass.
        await markOutboxAttempt(record.seq, {
          intentos: record.intentos + 1,
          nextAttemptAt: Date.now() + backoffMs(record.intentos + 1),
        });
        break;
      }
    }
  } finally {
    draining = false;
    notifySyncStatusChanged();
  }
}
