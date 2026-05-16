import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type Week, type WeekDetail, type WordSet } from '../api'

export default function Abenteuer() {
  const { weekSlug } = useParams<{ weekSlug?: string }>()
  const [weeks, setWeeks] = useState<Week[]>([])
  const [detail, setDetail] = useState<WeekDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    setLoading(true)
    if (weekSlug) {
      const match = weekSlug.match(/^woche-(\d+)$/)
      const param = match ? match[1] : weekSlug
      api.getWeek(param).then(setDetail).finally(() => setLoading(false))
    } else {
      api.listWeeks().then(setWeeks).finally(() => setLoading(false))
    }
  }, [weekSlug])

  if (loading) return <div className="deck"><p className="empty-state">Loading...</p></div>

  if (weekSlug && detail) {
    return (
      <div className="deck">
        <div>
          <button onClick={() => nav('/abenteuer')} className="deck-btn">← All weeks</button>
        </div>
        <div className="deck-header">
          <h1>Woche {detail.number}: {detail.title}</h1>
        </div>
        {detail.description && <p className="hint">{detail.description}</p>}

        <h2 className="section-title">Word sets</h2>
        <ul className="deck-list">
          {detail.sets.map(s => (
            <li key={s.id} className="deck-item">
              <button onClick={() => nav(`/sets/${s.slug}`)} className="deck-item-main">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {progressIcon(s.progressStatus)}
                  <span>{s.name}</span>
                  {s.level && <span className="starter-level">{s.level}</span>}
                  <span className="deck-item-count">· {s.wordCount} words</span>
                </div>
                {s.description && <div className="hint" style={{ marginTop: '4px' }}>{s.description}</div>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="deck">
      <div className="deck-header">
        <h1>Abenteuer</h1>
        <span className="deck-progress">Your German journey</span>
      </div>
      <p className="hint">Work through each week in order, or jump around. Each week has word sets and (soon) other activities.</p>

      <div className="weeks-grid">
        {weeks.map(w => {
          const pct = w.setCount > 0 ? Math.round((w.completedCount / w.setCount) * 100) : 0
          return (
            <button key={w.id} onClick={() => nav(`/abenteuer/woche-${w.number}`)} className="week-card">
              <div className="week-card-num">Woche {w.number}</div>
              <div className="week-card-title">{w.title}</div>
              {w.description && <div className="hint">{w.description}</div>}
              <div className="week-progress-bar">
                <div className="week-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="hint">{w.completedCount} / {w.setCount} sets completed</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function progressIcon(status: WordSet['progressStatus']) {
  if (status === 'Completed') return <span style={{ color: 'var(--accent)' }}>✓</span>
  if (status === 'Active') return <span style={{ color: 'var(--accent)' }}>◐</span>
  return <span style={{ opacity: 0.4 }}>○</span>
}
