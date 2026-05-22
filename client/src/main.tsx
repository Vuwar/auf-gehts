import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

async function forceResetIfRequested(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('force-refresh')) return false
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister().catch(() => false)))
    }
    if (typeof caches !== 'undefined') {
      const names = await caches.keys()
      await Promise.all(names.map(n => caches.delete(n).catch(() => false)))
    }
  } catch {}
  params.delete('force-refresh')
  const qs = params.toString()
  const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
  window.location.replace(cleanUrl)
  return true
}

if ('serviceWorker' in navigator) {
  let reloadedFromControllerChange = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedFromControllerChange) return
    reloadedFromControllerChange = true
    window.location.reload()
  })
}

forceResetIfRequested().then(redirecting => {
  if (redirecting) return
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
