import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type Week, type WeekDetail, type WordSet } from '../api'
import { useAuth } from '../auth'
import EditWeekSheet from './EditWeekSheet'
import CreateSetForWeekSheet from './CreateSetForWeekSheet'
import AssignExistingSetSheet from './AssignExistingSetSheet'
import CreateWeekSheet from './CreateWeekSheet'

export default function Abenteuer() {
  const { weekSlug } = useParams<{ weekSlug?: string }>()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'
  const [weeks, setWeeks] = useState<Week[]>([])
  const [detail, setDetail] = useState<WeekDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingWeek, setEditingWeek] = useState(false)
  const [creatingSet, setCreatingSet] = useState(false)
  const [assigningExisting, setAssigningExisting] = useState(false)
  const [creatingWeek, setCreatingWeek] = useState(false)
  const [confirmDeleteSet, setConfirmDeleteSet] = useState<string | null>(null)
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

  const reload = () => {
    if (weekSlug) {
      const match = weekSlug.match(/^woche-(\d+)$/)
      const param = match ? match[1] : weekSlug
      api.getWeek(param).then(setDetail)
    }
  }

  const deleteSet = async (id: string) => {
    await api.deleteSet(id)
    setConfirmDeleteSet(null)
    reload()
  }

  if (loading) return <div className="deck"><p className="empty-state">Loading...</p></div>

  if (weekSlug && detail) {
    return (
      <div className="deck">
        <div>
          <button onClick={() => nav('/abenteuer')} className="deck-btn">← All weeks</button>
        </div>
        <div className="deck-header">
          <h1>Woche {detail.number}: {detail.title}</h1>
          {isAdmin && (
            <button onClick={() => setEditingWeek(true)} className="deck-btn">Edit week</button>
          )}
        </div>
        {detail.description && <p className="hint">{detail.description}</p>}

        <h2 className="section-title">Word sets</h2>
        {detail.sets.length === 0 && <p className="empty-state">No sets yet.</p>}
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
              {isAdmin && (
                confirmDeleteSet === s.id ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setConfirmDeleteSet(null)} className="deck-btn cancel-btn">Cancel</button>
                    <button onClick={() => deleteSet(s.id)} className="deck-btn danger-solid">Delete</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteSet(s.id)} className="deck-btn danger" aria-label="Delete set">×</button>
                )
              )}
            </li>
          ))}
        </ul>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button onClick={() => setCreatingSet(true)} className="deck-btn primary">+ New set</button>
            <button onClick={() => setAssigningExisting(true)} className="deck-btn">Assign existing</button>
          </div>
        )}

        {detail.sets.length > 0 && (
          <button
            onClick={() => nav(`/sets/weekly:${detail.number}`)}
            className="deck-btn primary"
            style={{ width: '100%', marginTop: '8px', justifyContent: 'space-between', display: 'flex' }}
          >
            <span>View all weekly words</span>
            <span aria-hidden>→</span>
          </button>
        )}

        <h2 className="section-title">Reading texts</h2>
        {detail.readingTexts.length === 0 && <p className="empty-state">No texts assigned to this week.</p>}
        <ul className="deck-list">
          {detail.readingTexts.map(t => (
            <li key={t.id} className="deck-item">
              <button onClick={() => nav(`/reader/${t.id}`)} className="deck-item-main">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{t.title}</span>
                  {t.level && <span className="starter-level">{t.level}</span>}
                  <span className="deck-item-count">· {t.questionCount} questions · {t.charCount} chars</span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {editingWeek && (
          <EditWeekSheet
            week={detail}
            onClose={() => setEditingWeek(false)}
            onUpdated={reload}
            onDeleted={() => nav('/abenteuer')}
          />
        )}
        {creatingSet && (
          <CreateSetForWeekSheet
            weekId={detail.id}
            onClose={() => setCreatingSet(false)}
            onCreated={reload}
          />
        )}
        {assigningExisting && (
          <AssignExistingSetSheet
            weekId={detail.id}
            onClose={() => setAssigningExisting(false)}
            onAssigned={reload}
          />
        )}
      </div>
    )
  }

  return (
    <div className="deck">
      <div className="deck-header">
        <div>
          <h1>Abenteuer</h1>
          <span className="deck-progress">Your German journey</span>
        </div>
        {isAdmin && (
          <button onClick={() => setCreatingWeek(true)} className="deck-btn primary">+ Add week</button>
        )}
      </div>
      <p className="hint">Work through each week in order, or jump around.</p>

      {creatingWeek && (
        <CreateWeekSheet
          nextNumber={(weeks[weeks.length - 1]?.number ?? 0) + 1}
          onClose={() => setCreatingWeek(false)}
          onCreated={() => api.listWeeks().then(setWeeks)}
        />
      )}

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
