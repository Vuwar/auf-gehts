import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      window.setInterval(() => {
        registration.update().catch(() => {})
      }, 60 * 60 * 1000)
    },
  })

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
