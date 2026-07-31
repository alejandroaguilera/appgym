import { countPendingOutbox } from "@/lib/db/outbox";

type Listener = () => void;
const listeners = new Set<Listener>();

// Minimal pub-sub so the sync status indicator can re-render whenever the
// outbox changes, without pulling in a data-fetching library.
export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySyncStatusChanged(): void {
  for (const l of listeners) l();
}

export async function getPendingCount(): Promise<number> {
  return countPendingOutbox();
}
