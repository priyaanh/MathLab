// MathLab service worker — NETWORK-FIRST.
//
// The previous version was cache-first with a fixed cache name, which meant a
// browser served the very first copy of the app forever and never picked up new
// changes. This version always tries the network first (so updates show up
// immediately when online) and only falls back to the cache when offline.
//
// Bumping CACHE_NAME + deleting old caches on activate purges any stale assets
// left behind by the old worker.
// Bump on each cache-shape change so activate purges the previous cache.
const CACHE_NAME = 'mathlab-v3'
// Relative to the worker's scope so they resolve under a base path (e.g.
// GitHub Pages serves the app from /<repo>/, not the domain root).
const PRECACHE = ['./', './index.html', './manifest.json']

self.addEventListener('install', (event) => {
    // Activate this worker as soon as it's installed, without waiting for tabs to close.
    self.skipWaiting()
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).catch(() => {})
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Remove every cache that isn't the current one (clears the old v1 cache).
        const keys = await caches.keys()
        await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        await self.clients.claim()
        // One-time self-heal: reload any open tab so it drops the stale assets
        // the old worker was serving and loads the fresh app.
        const clients = await self.clients.matchAll({ type: 'window' })
        for (const client of clients) {
            client.navigate(client.url).catch(() => {})
        }
    })())
})

self.addEventListener('fetch', (event) => {
    const req = event.request
    // Only handle same-origin GETs; let everything else pass through untouched.
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return

    event.respondWith((async () => {
        try {
            const fresh = await fetch(req)
            // Cache a copy of good responses for offline fallback.
            if (fresh && fresh.status === 200 && fresh.type === 'basic') {
                const copy = fresh.clone()
                caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {})
            }
            return fresh
        } catch {
            // Offline: serve from cache if we have it.
            const cached = await caches.match(req)
            return cached || Response.error()
        }
    })())
})
