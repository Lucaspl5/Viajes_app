const CACHE_NAME = "bitacora-v2";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : "" }; }
  const title = payload.title || "Bitácora de Viaje";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { code: payload.code },
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const code = event.notification.data && event.notification.data.code;
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(list => {
      for (const client of list) if ("focus" in client) return client.focus();
      if (clients.openWindow) return clients.openWindow(code ? `/?code=${code}` : "/");
    })
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // The app shell (navigations + "/") must always be fetched fresh so a new
  // deploy is picked up right away — cache-first here left everyone stuck on
  // whatever version they first loaded. The cache is only a fallback for
  // offline use.
  if (event.request.mode === "navigate" || url.pathname === "/") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Hashed build assets (JS/CSS chunks) are immutable per deploy, so
  // cache-first is safe and keeps repeat loads fast.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === "basic") {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      });
    })
  );
});
