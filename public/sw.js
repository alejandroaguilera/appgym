// Rest-timer notification worker (spec §5.5, phase 3). Deliberately does
// NOT register a `fetch` handler and does NOT cache anything — full
// app-shell precaching / offline-from-cold-start is phase 4 and explicitly
// out of scope for this build. This worker's only job: fire a notification
// when a rest period ends, so the alarm doesn't depend on the tab being
// alive. Vibration + sound (in-page) are the reliable complements; this is
// the best-effort layer — see the honest limits noted in lib/rest-timer docs.

let scheduledTimeout = null;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "scheduleRestEnd") {
    if (scheduledTimeout) clearTimeout(scheduledTimeout);
    const delay = Math.max(0, data.endsAt - Date.now());
    scheduledTimeout = setTimeout(() => {
      self.registration.showNotification("Descanso terminado", {
        body: "Es hora de la siguiente serie.",
        tag: "rest-timer",
        renotify: true,
        requireInteraction: false,
        vibrate: [200, 100, 200],
      });
    }, delay);
  }

  if (data.type === "cancelRestEnd") {
    if (scheduledTimeout) {
      clearTimeout(scheduledTimeout);
      scheduledTimeout = null;
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow("/");
      }
    })
  );
});
