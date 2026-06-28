/* global URL, caches, fetch, self */
const CACHE_NAME = "helper-tracker-static-v1";
const APP_SHELL = ["./", "manifest.webmanifest", "pwa-icon.svg"].map((path) =>
  new URL(path, self.registration.scope).toString(),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (response.ok) {
          const responseToCache = response.clone();
          void caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache));
        }

        return response;
      });
    }),
  );
});
