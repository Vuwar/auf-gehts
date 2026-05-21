import { useEffect, useState } from 'react'
import { subscribeOfflineState } from '../offlineQueue'

export default function OfflineIndicator() {
  const [state, setState] = useState<{ online: boolean; queued: number }>({
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    queued: 0,
  })

  useEffect(() => subscribeOfflineState(setState), [])

  useEffect(() => {
    document.documentElement.dataset.offline = state.online ? 'false' : 'true'
    return () => { document.documentElement.dataset.offline = 'false' }
  }, [state.online])

  if (state.online && state.queued === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`offline-banner ${state.online ? 'syncing' : 'offline'}`}
    >
      <span className="offline-dot" aria-hidden />
      {!state.online && <span>You're offline — changes are unavailable until connection is restored</span>}
      {state.online && state.queued > 0 && <span>Back online · syncing {state.queued} pending change{state.queued !== 1 ? 's' : ''}…</span>}
    </div>
  )
}
