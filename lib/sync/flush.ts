import { drainOutbox } from "./drain";
import { listOutbox } from "@/lib/db/outbox";

let listenersRegistered = false;

// Registers the flush triggers required by §5.4: visibilitychange and
// pagehide, NOT beforeunload alone (unreliable on mobile). beforeunload is
// still attached as an extra best-effort hook, never as the sole guarantee.
export function initSyncListeners(): void {
  if (listenersRegistered || typeof window === "undefined") return;
  listenersRegistered = true;

  const trigger = () => {
    void triggerFlush();
  };

  document.addEventListener("visibilitychange", trigger);
  window.addEventListener("pagehide", trigger);
  window.addEventListener("online", trigger);
  window.addEventListener("beforeunload", trigger);

  // Lightweight periodic nicety while the tab is alive and online; never the
  // correctness mechanism — the IndexedDB write already happened before this.
  setInterval(() => {
    if (document.visibilityState === "visible" && navigator.onLine) trigger();
  }, 15_000);

  trigger();
}

export async function triggerFlush(): Promise<void> {
  await drainOutbox();
  await sendBeaconFallback();
}

// sendBeacon is the only mechanism the browser guarantees to attempt during
// pagehide/unload teardown, since an in-flight fetch() can be aborted mid-air.
// It does not replace drainOutbox — it's a parallel best-effort delivery of
// whatever is still pending at the moment of teardown.
async function sendBeaconFallback(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) return;
  const pending = (await listOutbox()).filter((r) => !r.permanentError);
  if (pending.length === 0) return;
  const payload = pending.map((r) => ({ method: r.method, url: r.url, body: r.body }));
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  navigator.sendBeacon("/api/sync/beacon", blob);
}
