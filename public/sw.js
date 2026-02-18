// Foody Push Notification Service Worker
// This file must be served from the root of the domain (public/)
// so it has scope over all pages.

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Foody", body: event.data.text() };
  }

  const title = data.title || "Foody";
  const options = {
    body: data.body || "You have a new notification",
    icon: "/logo-icon.svg",
    badge: "/logo-icon.svg",
    vibrate: [200, 100, 200],
    tag: "foody-order-" + (data.order_id || "notification"),
    renotify: true,
    data: {
      url: data.url || "/",
      orderId: data.order_id,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// When user clicks the notification, open/focus the relevant page
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // If a matching tab is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
