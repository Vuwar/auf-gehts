import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Stats, type Week } from '../api'
import { useAuth } from '../auth'
import ErrorView from './ErrorView'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const displayLabel = profile?.displayName || user?.email
  const [stats, setStats] = useState<Stats | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const nav = useNavigate()

  const load = () => {
    setLoading(true)
    setError(null)
    api.getDashboard()
      .then(({ stats: s, weeks: w }) => { setStats(s); setWeeks(w) })
      .catch(e => setError(e))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="deck"><p className="empty-state">Loading...</p></div>
  if (error) return <div className="deck"><ErrorView error={error} onRetry={load} /></div>
  if (!stats) return null

  const currentWeek = weeks.find(w => w.completedCount < w.setCount) ?? weeks[weeks.length - 1]

  return (
    <div className="deck">
      <div className="deck-header">
        <div>
          <h1>Willkommen{profile?.displayName ? `, ${profile.displayName}` : ''}!</h1>
          <p className="hint">Signed in as {displayLabel}</p>
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
          <span className="stat-value">{stats.vocabCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active sets</span>
          <span className="stat-value">{stats.activeSetCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Completed sets</span>
          <span className="stat-value">{stats.completedSetCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Added this week</span>
          <span className="stat-value">{stats.wordsAddedThisWeek}</span>
        </div>
      </div>

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
      </div>
    </div>
  )
}
