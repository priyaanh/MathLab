
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx' 

// If a lazily-loaded page chunk fails to load, it's almost always a stale
// index.html left in the browser cache after a redeploy pointing at old,
// now-deleted chunk hashes. Reload to pull the current build. (This is
// why routes like Profile could 404 on GitHub Pages while Home — bundled
// eagerly — still worked.)
//
// The guard is a timestamp rather than a flag. A plain flag disarmed the heal
// permanently: the first failure set it and it lived in sessionStorage for the
// rest of the tab's life, so every later failure was left to fail. A cooldown
// still blocks a reload loop while letting a genuine later failure recover.
const RELOAD_GUARD = 'mathlab-chunk-reloaded'
const RELOAD_COOLDOWN_MS = 15000
window.addEventListener('vite:preloadError', () => {
  const last = Number(sessionStorage.getItem(RELOAD_GUARD) || 0)
  if (!Number.isFinite(last) || Date.now() - last > RELOAD_COOLDOWN_MS) {
    sessionStorage.setItem(RELOAD_GUARD, String(Date.now()))
    window.location.reload()
  }
})

/*
 * The service worker is a production concern only.
 *
 * It caches every same-origin GET, which on a dev server means Vite's module
 * URLs. Restart the server and the page can be handed a cached app shell whose
 * module graph points at ?t= URLs that no longer exist — a "Failed to fetch
 * dynamically imported module" that survives reloads and outlives any code fix,
 * because the fix itself is behind the same stale cache.
 *
 * Skipping registration is not enough on its own: a worker registered by an
 * earlier build stays installed and keeps serving. Dev actively tears down any
 * existing registration and drops its caches.
 */
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      // Resolved against the app's base path — on GitHub Pages the app lives
      // under /<repo>/, so a bare "/sw.js" would 404 and never register.
      const swUrl = `${import.meta.env.BASE_URL}sw.js`
      navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError)
        })
    })
  } else {
    /*
     * Order matters: a live worker re-caches every response it serves, so
     * clearing first only hands it fresh entries to write back. Unregister,
     * wait for that to land, then drop what it left behind.
     *
     * Both lookups are used on purpose. getRegistrations() has been seen to
     * return nothing while navigator.serviceWorker.controller is still set, and
     * a worker missed by one call keeps serving the stale shell this is meant
     * to clear, so the scope-level lookup backs it up.
     */
    const unregisterAll = async () => {
      const found = []
      try { found.push(...await navigator.serviceWorker.getRegistrations()) } catch { /* not exposed */ }
      try {
        const own = await navigator.serviceWorker.getRegistration()
        if (own && !found.includes(own)) found.push(own)
      } catch { /* none for this scope */ }
      await Promise.all(found.map(r => r.unregister().catch(() => false)))
    }

    unregisterAll()
      .then(() => (typeof caches === 'undefined' ? [] : caches.keys()))
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .catch(() => { /* no cache storage */ })
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
