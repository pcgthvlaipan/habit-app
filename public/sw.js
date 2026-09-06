// Bump this string on EVERY deploy (e.g. habit-app-v3, habit-app-v4 …) so the
// `activate` handler purges the previous cache and clients pick up fresh assets.
const CACHE = "habit-app-v2";
const PRECACHE = ["/", "/index.html", "/icon.png", "/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      // Resilient precache: one 404 must not fail the whole install.
      Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  // Purge every cache that isn't the current one.
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        // Offline deep links: fall back to the cached app shell for navigations.
        if (e.request.mode === "navigate") {
          const shell = await caches.match("/index.html") || await caches.match("/");
          if (shell) return shell;
        }
        // Never resolve respondWith(undefined) — hand back a real Response.
        return new Response("", { status: 504, statusText: "Offline" });
      })
  );
});
