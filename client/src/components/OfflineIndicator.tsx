import { useEffect, useState } from 'react'
import { subscribeOfflineState } from '../offlineQueue'

export default function OfflineIndicator() {
  const [state, setState] = useState<{ online: boolean; queued: number }>({
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    queued: 0,
  })

  useEffect(() => subscribeOfflineState(setState), [])

  if (state.online && state.queued === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`offline-pill ${state.online ? 'syncing' : 'offline'}`}
    >
      <span className="offline-dot" aria-hidden />
      {!state.online && <span>Offline</span>}
      {state.online && state.queued > 0 && <span>Syncing {state.queued}…</span>}
      {!state.online && state.queued > 0 && <span> · {state.queued} pending</span>}
    </div>
  )
}
