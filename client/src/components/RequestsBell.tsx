import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type PendingRequests } from '../api'

const POLL_INTERVAL_MS = 60_000

export default function RequestsBell() {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState<number>(0)
  const [data, setData] = useState<PendingRequests | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(async () => {
    try {
      const resp = await api.getFriendRequestCount()
      setCount(resp.incoming)
    } catch {
      // ignore — silent retry on next tick
    }
  }, [])

  useEffect(() => {
    refreshCount()
    const id = window.setInterval(refreshCount, POLL_INTERVAL_MS)
    const onFocus = () => refreshCount()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshCount])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  const openDropdown = async () => {
    const next = !open
    setOpen(next)
    if (!next) return
    setLoadingList(true)
    setError(null)
    try {
      const resp = await api.listFriendRequests()
      setData(resp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load requests')
    } finally {
      setLoadingList(false)
    }
  }

  const onAccept = async (id: string) => {
    if (!data) return
    const prev = data
    setData({
      incoming: data.incoming.filter(r => r.id !== id),
      outgoing: data.outgoing,
    })
    setCount(c => Math.max(0, c - 1))
    try {
      await api.acceptFriendRequest(id)
    } catch (e) {
      setData(prev)
      setCount(prev.incoming.length)
      setError(e instanceof Error ? e.message : 'Failed to accept')
    }
  }

  const onDecline = async (id: string) => {
    if (!data) return
    const prev = data
    setData({
      incoming: data.incoming.filter(r => r.id !== id),
      outgoing: data.outgoing,
    })
    setCount(c => Math.max(0, c - 1))
    try {
      await api.declineFriendRequest(id)
    } catch (e) {
      setData(prev)
      setCount(prev.incoming.length)
      setError(e instanceof Error ? e.message : 'Failed to decline')
    }
  }

  const onCancel = async (id: string) => {
    if (!data) return
    const prev = data
    setData({
      incoming: data.incoming,
      outgoing: data.outgoing.filter(r => r.id !== id),
    })
    try {
      await api.cancelFriendRequest(id)
    } catch (e) {
      setData(prev)
      setError(e instanceof Error ? e.message : 'Failed to cancel')
    }
  }

  return (
    <div className="requests-bell" ref={ref}>
      <button
        onClick={openDropdown}
        className="requests-bell-trigger"
        aria-label={`Friend requests${count > 0 ? ` (${count} pending)` : ''}`}
      >
        <span aria-hidden="true">🔔</span>
        {count > 0 && <span className="requests-bell-badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="requests-bell-dropdown" role="menu">
          <div className="requests-bell-header"><strong>Friend requests</strong></div>
          <div className="user-menu-divider" />
          {loadingList && <div className="requests-bell-empty">Loading…</div>}
          {error && <div className="requests-bell-empty" style={{ color: 'var(--danger, #c33)' }}>{error}</div>}
          {!loadingList && data && (
            <>
              <div className="requests-bell-section-label">Incoming</div>
              {data.incoming.length === 0 && (
                <div className="requests-bell-empty">No incoming requests</div>
              )}
              {data.incoming.map(r => (
                <div key={r.id} className="requests-bell-row">
                  <Link to={`/profile/${r.otherUserId}`} className="user-avatar" onClick={() => setOpen(false)}>
                    {r.otherUserDisplayName[0]?.toUpperCase() ?? '?'}
                  </Link>
                  <span className="requests-bell-name">{r.otherUserDisplayName}</span>
                  <button onClick={() => onAccept(r.id)} className="deck-btn primary">Accept</button>
                  <button onClick={() => onDecline(r.id)} className="deck-btn">Decline</button>
                </div>
              ))}
              <div className="user-menu-divider" />
              <div className="requests-bell-section-label">Sent</div>
              {data.outgoing.length === 0 && (
                <div className="requests-bell-empty">No outgoing requests</div>
              )}
              {data.outgoing.map(r => (
                <div key={r.id} className="requests-bell-row">
                  <Link to={`/profile/${r.otherUserId}`} className="user-avatar" onClick={() => setOpen(false)}>
                    {r.otherUserDisplayName[0]?.toUpperCase() ?? '?'}
                  </Link>
                  <span className="requests-bell-name">{r.otherUserDisplayName}</span>
                  <button onClick={() => onCancel(r.id)} className="deck-btn">Cancel</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
