import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
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

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    nav('/login')
  }

  return (
    <div className="user-menu" ref={ref}>
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
            <SettingsIcon /> Settings
          </Link>
          <Link to="/alphabet" onClick={() => setOpen(false)} className="user-menu-item">
            <AlphabetIcon /> Alphabet
          </Link>
          {profile?.role === 'Admin' && (
            <Link to="/admin/logs" onClick={() => setOpen(false)} className="user-menu-item">
              <LogsIcon /> Logs & metrics
            </Link>
          )}
          <button onClick={handleSignOut} className="user-menu-item">
            <SignOutIcon /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function StreakIndicator() {
  const { profile } = useAuth()
  const streak = profile?.currentStreak ?? 0
  return (
    <span
      className={`streak-badge ${streak > 0 ? '' : 'streak-cold'}`}
      title={streak > 0 ? `${streak} day streak` : 'No streak yet - study today!'}
    >
      <FlameIcon active={streak > 0} /> {streak}
    </span>
  )
}

function SettingsIcon() {
  return <MenuIcon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 1 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.06A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.06A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.06A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.34.16.68.36 1 .6.32.25.7.4 1.1.4H21a2 2 0 1 1 0 4h-.06A1.7 1.7 0 0 0 19.4 15z" /></MenuIcon>
}

function AlphabetIcon() {
  return <MenuIcon><path d="M4 19V5h6" /><path d="M4 12h5" /><path d="M14 19l4-14 4 14" /><path d="M16 13h4" /></MenuIcon>
}

function LogsIcon() {
  return <MenuIcon><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16V9" /><path d="M13 16V6" /><path d="M18 16v-4" /></MenuIcon>
}

function SignOutIcon() {
  return <MenuIcon><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 4v16" /></MenuIcon>
}

function FlameIcon({ active }: { active: boolean }) {
  return (
    <svg className="streak-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={active ? 'M12 22c4.2 0 7-2.8 7-6.6 0-2.8-1.4-5-4.2-7.2-.4 1.9-1.3 3.1-2.7 3.8.4-3.3-.9-6.1-4-8.4.1 3.4-1 5.4-2.5 7.2C4.5 12.1 4 13.5 4 15.4 4 19.2 7.2 22 12 22z' : 'M12 21c3.4 0 6-2.3 6-5.7 0-2.3-1.1-4.1-3.4-5.9-.3 1.4-1.1 2.4-2.3 3 .2-2.5-.7-4.7-3.1-6.6 0 2.7-.9 4.4-2.1 5.8A5.6 5.6 0 0 0 6 15.3c0 3.4 2.6 5.7 6 5.7z'} />
    </svg>
  )
}

function MenuIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}
