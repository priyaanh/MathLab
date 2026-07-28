
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx' 

// If a lazily-loaded page chunk fails to load, it's almost always a stale
// index.html left in the browser cache after a redeploy pointing at old,
// now-deleted chunk hashes. Reload once to pull the current build. (This is
// why routes like Profile could 404 on GitHub Pages while Home — bundled
// eagerly — still worked.)
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('mathlab-chunk-reloaded')) {
    sessionStorage.setItem('mathlab-chunk-reloaded', '1')
    window.location.reload()
  }
})

// Register the service worker for PWA / offline support. The URL must be
// resolved against the app's base path — on GitHub Pages the app lives under
// /<repo>/, so a bare "/sw.js" would 404 and the worker would never register.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError)
      })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
