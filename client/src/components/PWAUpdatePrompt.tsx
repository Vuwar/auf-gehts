import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const FRESH_TAB_WINDOW_MS = 4000
const UPDATE_POLL_MS = 5 * 60 * 1000

export default function PWAUpdatePrompt() {
  const mountedAtRef = useRef(Date.now())
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      registrationRef.current = registration
      registration.update().catch(() => {})
      window.setInterval(() => {
        registration.update().catch(() => {})
      }, UPDATE_POLL_MS)
    },
  })

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      registrationRef.current?.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  useEffect(() => {
    if (!needRefresh) return
    const elapsed = Date.now() - mountedAtRef.current
    if (elapsed < FRESH_TAB_WINDOW_MS) {
      updateServiceWorker(true)
    }
  }, [needRefresh, updateServiceWorker])

  if (!needRefresh) return null

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <div>
        <strong>Update available</strong>
        <span>Refresh to use latest app.</span>
      </div>
      <button className="deck-btn primary" onClick={() => updateServiceWorker(true)}>
        Update
      </button>
      <button className="toast-undo" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
    </div>
  )
}
