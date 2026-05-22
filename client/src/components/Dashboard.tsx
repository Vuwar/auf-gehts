import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Dashboard as DashboardData, type Week } from '../api'
import { useAuth } from '../auth'
import ErrorView from './ErrorView'
import { PageSkeleton } from './Skeletons'
import { FlameIcon, LibraryIcon, ReaderBookIcon, MapIcon, AlphabetIcon } from './Icons'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [weeks, setWeeks] = useState<Week[] | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const nav = useNavigate()

  useEffect(() => { load() }, [])

  const load = () => {
    setLoading(true)
    setError(null)
    api.listWeeks()
      .then(async ws => {
        setWeeks(ws)
        const current = ws.find(w => w.completedCount < w.setCount) ?? ws[ws.length - 1]
        if (!current) {
          setData({ friends: [] })
          return
        }
        const dash = await api.getDashboard(current.id)
        setData(dash)
      })
      .catch(e => setError(e))
      .finally(() => setLoading(false))
  }

  if (loading) return <PageSkeleton page="dashboard" />
  if (error) return <div className="deck"><ErrorView error={error} onRetry={load} /></div>
  if (!data || !weeks) return null

  const currentWeek = weeks.find(w => w.completedCount < w.setCount) ?? weeks[weeks.length - 1]
  const greeting = profile?.displayName || user?.email
  const currentStreak = profile?.currentStreak ?? 0
  const longestStreak = profile?.longestStreak ?? 0

  return (
    <div className="deck">
      <div className="deck-header">
        <div>
          <h1>Willkommen{profile?.displayName ? `, ${profile.displayName}` : ''}!</h1>
          <p className="hint">Signed in as {greeting}</p>
        </div>
      </div>

      <div className="streak-hero">
        <span className="streak-hero-icon"><FlameIcon size={28} /></span>
        <div className="streak-hero-text">
          <strong>{currentStreak} day{currentStreak === 1 ? '' : 's'}</strong>
          <span className="hint">Current streak · longest {longestStreak}</span>
        </div>
      </div>

      {currentWeek && (
        <div className="homework-card">
          <span className="card-label">Current week</span>
          <h2 style={{ margin: '4px 0' }}>Woche {currentWeek.number}: {currentWeek.title}</h2>
          {currentWeek.description && <p className="hint">{currentWeek.description}</p>}
          <p className="hint">{currentWeek.completedCount} / {currentWeek.setCount} sets completed</p>
          <button onClick={() => nav(`/abenteuer/woche-${currentWeek.number}`)} className="deck-btn primary" style={{ marginTop: '8px' }}>
            Continue journey →
          </button>
        </div>
      )}

      {data.friends.length > 0 ? (
        <>
          <h2 className="section-title">Friends</h2>
          <ul className="friend-list">
            {data.friends.map(f => {
              const pct = f.currentWeekTotal > 0 ? Math.round((f.currentWeekCompleted / f.currentWeekTotal) * 100) : 0
              return (
                <li key={f.userId} className="friend-row">
                  <Link to={`/profile/${f.userId}`} className="user-avatar" aria-label={`Open ${f.displayName}'s profile`}>
                    {f.displayName[0]?.toUpperCase()}
                  </Link>
                  <div className="friend-text">
                    <Link to={`/profile/${f.userId}`}><strong>{f.displayName}</strong></Link>
                    {f.currentWeekNumber !== null && (
                      <span className="hint">Woche {f.currentWeekNumber}: {f.currentWeekCompleted}/{f.currentWeekTotal} sets</span>
                    )}
                    <div className="friend-progress-bar">
                      <div className="friend-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {f.currentStreak > 0 && (
                    <span className="streak-badge"><FlameIcon size={14} /> {f.currentStreak}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <div className="homework-card">
          <span className="card-label">Friends</span>
          <p className="hint" style={{ margin: '4px 0' }}>No friends yet. Find people on your profile to compare progress.</p>
          <button onClick={() => nav('/profile')} className="deck-btn" style={{ marginTop: '8px' }}>
            Go to profile →
          </button>
        </div>
      )}

      <h2 className="section-title">Quick actions</h2>
      <div className="action-grid">
        <button className="action-card" onClick={() => nav('/abenteuer')}>
          <span className="action-icon"><MapIcon size={28} /></span>
          <strong>Abenteuer</strong>
          <span className="hint">Course roadmap by week</span>
        </button>
        <button className="action-card" onClick={() => nav('/library')}>
          <span className="action-icon"><LibraryIcon size={28} /></span>
          <strong>Library</strong>
          <span className="hint">Active, completed, and your sets</span>
        </button>
        <button className="action-card" onClick={() => nav('/reader')}>
          <span className="action-icon"><ReaderBookIcon size={28} /></span>
          <strong>Reader</strong>
          <span className="hint">Paste/generate text, save words</span>
        </button>
        <button className="action-card" onClick={() => nav('/alphabet')}>
          <span className="action-icon"><AlphabetIcon size={28} /></span>
          <strong>Alphabet</strong>
          <span className="hint">German letter pronunciation</span>
        </button>
      </div>
    </div>
  )
}
