// Manhattan Market dashboard — service worker for new-order alerts.
// Shows the notification the server pushes (lib/push.ts), and opens the
// dashboard when it's tapped. Doesn't cache anything.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "New online order";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Open the dashboard to see it.",
      icon: "/dashboard-icon.png",
      badge: "/dashboard-icon.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      requireInteraction: true,
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes("/dashboard") && "focus" in w) {
          w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
