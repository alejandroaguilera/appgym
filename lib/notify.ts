export async function requestNotificationPermission(): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // ignore
    }
  }
}

async function postToSW(message: unknown): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  reg?.active?.postMessage(message);
}

export function scheduleRestEndNotification(endsAt: number): void {
  void postToSW({ type: "scheduleRestEnd", endsAt });
}

export function cancelRestEndNotification(): void {
  void postToSW({ type: "cancelRestEnd" });
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // iOS Safari has no Vibration API — silent no-op, not a crash.
    }
  }
}
