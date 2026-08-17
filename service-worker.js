// service-worker.js — caches the app shell so the interface (not user audio
// files) is available offline and the app can be installed to the home screen.
//
// Strategy: cache-first for shell assets, with a network-fallback for
// anything not precached. Bump CACHE_NAME whenever shell files change so
// clients pick up the new version instead of serving stale cached files.

const CACHE_NAME = "cuesheet-shell-v10";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/base.css",
  "./css/library.css",
  "./css/timeline.css",
  "./css/timestamps.css",
  "./css/player.css",
  "./js/app.js",
  "./js/db.js",
  "./js/fingerprint.js",
  "./js/audio-engine.js",
  "./js/timeline.js",
  "./js/scrub-rate.js",
  "./js/timestamp-list.js",
  "./js/timestamp-editor.js",
  "./js/metronome.js",
  "./js/onset-detect.js",
  "./js/tempo-detect.js",
  "./js/cuesheet-io.js",
  "./js/utils.js",
  "./js/library-view.js",
  "./js/player-view.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests for our own origin — never intercept audio
  // file blobs (object URLs) or cross-origin requests.
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Opportunistically cache new same-origin shell assets as they're fetched.
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached: fall back to the shell for navigations
          // so the app still opens (library screen) rather than erroring.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return Response.error();
        });
    })
  );
});
