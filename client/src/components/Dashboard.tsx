import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Dashboard as DashboardData } from '../api'
import { useAuth } from '../auth'
import ErrorView from './ErrorView'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const nav = useNavigate()

  useEffect(() => { load() }, [])

  const load = () => {
    setLoading(true)
    setError(null)
    api.getDashboard()
      .then(setData)
      .catch(e => setError(e))
      .finally(() => setLoading(false))
  }

  if (loading) return <div className="deck"><p className="empty-state">Loading...</p></div>
  if (error) return <div className="deck"><ErrorView error={error} onRetry={load} /></div>
  if (!data) return null

  const currentWeek = data.weeks.find(w => w.completedCount < w.setCount) ?? data.weeks[data.weeks.length - 1]
  const greeting = profile?.displayName || user?.email

  return (
    <div className="deck">
      <div className="deck-header">
        <div>
          <h1>Willkommen{profile?.displayName ? `, ${profile.displayName}` : ''}!</h1>
          <p className="hint">Signed in as {greeting}</p>
        </div>
      </div>

      <div className="streak-hero">
        <span className="streak-hero-icon">🔥</span>
        <div className="streak-hero-text">
          <strong>{data.currentStreak} day{data.currentStreak === 1 ? '' : 's'}</strong>
          <span className="hint">Current streak · longest {data.longestStreak}</span>
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

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">My Vocabulary</span>
          <span className="stat-value">{data.stats.vocabCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active sets</span>
          <span className="stat-value">{data.stats.activeSetCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Completed sets</span>
          <span className="stat-value">{data.stats.completedSetCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Added this week</span>
          <span className="stat-value">{data.stats.wordsAddedThisWeek}</span>
        </div>
      </div>

      {data.friends.length > 0 && (
        <>
          <h2 className="section-title">Friends</h2>
          <ul className="friend-list">
            {data.friends.map(f => {
              const pct = f.currentWeekTotal > 0 ? Math.round((f.currentWeekCompleted / f.currentWeekTotal) * 100) : 0
              return (
                <li key={f.userId} className="friend-row">
                  <span className="user-avatar">{f.displayName[0]?.toUpperCase()}</span>
                  <div className="friend-text">
                    <strong>{f.displayName}</strong>
                    {f.currentWeekNumber !== null && (
                      <span className="hint">Woche {f.currentWeekNumber}: {f.currentWeekCompleted}/{f.currentWeekTotal} sets</span>
                    )}
                    <div className="friend-progress-bar">
                      <div className="friend-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {f.currentStreak > 0 && (
                    <span className="streak-badge">🔥 {f.currentStreak}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <h2 className="section-title">Quick actions</h2>
      <div className="action-grid">
        <button className="action-card" onClick={() => nav('/abenteuer')}>
          <span className="action-icon">🗺️</span>
          <strong>Abenteuer</strong>
          <span className="hint">Course roadmap by week</span>
        </button>
        <button className="action-card" onClick={() => nav('/library')}>
          <span className="action-icon">📚</span>
          <strong>Library</strong>
          <span className="hint">Active, completed, and your sets</span>
        </button>
        <button className="action-card" onClick={() => nav('/reader')}>
          <span className="action-icon">📖</span>
          <strong>Reader</strong>
          <span className="hint">Paste/generate text, save words</span>
        </button>
        <button className="action-card" onClick={() => nav('/alphabet')}>
          <span className="action-icon">🔤</span>
          <strong>Alphabet</strong>
          <span className="hint">German letter pronunciation</span>
        </button>
      </div>
    </div>
  )
}
