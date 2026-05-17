import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function UserMenu() {
  const { user, profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()

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

  const label = profile?.displayName || user?.email || '?'
  const initial = label[0]?.toUpperCase() ?? '?'
  const streak = profile?.currentStreak ?? 0

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    nav('/login')
  }

  return (
    <div className="user-menu" ref={ref}>
      <span
        className={`streak-badge ${streak > 0 ? '' : 'streak-cold'}`}
        title={streak > 0 ? `${streak} day streak` : 'No streak yet — study today!'}
      >
        {streak > 0 ? '🔥' : '🜸'} {streak}
      </span>
      <button onClick={() => setOpen(!open)} className="user-menu-trigger" aria-label="User menu">
        <span className="user-menu-avatar">{initial}</span>
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-header">
            <span className="user-menu-avatar large">{initial}</span>
            <div className="user-menu-info">
              <strong>{label}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          <div className="user-menu-divider" />
          <Link to="/profile" onClick={() => setOpen(false)} className="user-menu-item">
            <span>⚙️</span> Settings
          </Link>
          <button onClick={handleSignOut} className="user-menu-item">
            <span>↩</span> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
