import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type ReadingText } from '../api'
import CreateTextSheet from './CreateTextSheet'
import { ListSkeleton } from './Skeletons'

const LEVELS = ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default function Reader() {
  const nav = useNavigate()
  const [texts, setTexts] = useState<ReadingText[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('All')
  const [creating, setCreating] = useState(false)

  const load = () => {
    setLoading(true)
    api.listReadingTexts()
      .then(setTexts)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return texts.filter(t => {
      if (levelFilter !== 'All' && t.level !== levelFilter) return false
      if (!q) return true
      return t.title.toLowerCase().includes(q)
        || (t.createdByName?.toLowerCase().includes(q) ?? false)
    })
  }, [texts, search, levelFilter])

  return (
    <div className="deck">
      <div className="deck-header">
        <div>
          <h1>Reader</h1>
          <span className="deck-progress">Public German texts to read</span>
        </div>
      </div>

      <div className="form-row">
        <input
          type="text"
          placeholder="Search texts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="tab-toggle" style={{ flexWrap: 'wrap' }}>
          {LEVELS.map(lv => (
            <button
              key={lv}
              onClick={() => setLevelFilter(lv)}
              className={`tab-toggle-btn ${levelFilter === lv ? 'active' : ''}`}
            >
              {lv}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <p className="empty-state">No texts yet. Tap + to add one.</p>
      ) : (
        <ul className="deck-list">
          {filtered.map(t => (
            <li key={t.id} className="deck-item deck-item--passage">
              <button onClick={() => nav(`/reader/${t.id}`)} className="deck-item-main">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="deck-item-icon" aria-hidden>
                    <PassageIcon />
                  </span>
                  <strong>{t.title}</strong>
                  {t.level && <span className="starter-level">{t.level}</span>}
                  {t.audioUrl && <span className="deck-item-count" aria-label="Has audio">🎧</span>}
                  {t.weekNumber !== null && <span className="deck-item-count">· Woche {t.weekNumber}</span>}
                  {t.questions.length > 0 && <span className="deck-item-count">· {t.questions.length} questions</span>}
                </div>
                <div className="hint" style={{ marginTop: '4px' }}>
                  {t.createdByName ?? 'Unknown'} · {t.content.length} chars
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        className="reader-fab"
        onClick={() => setCreating(true)}
        aria-label="Create new text"
      >
        +
      </button>

      {creating && (
        <CreateTextSheet
          onClose={() => setCreating(false)}
          onCreated={(t) => { setCreating(false); setTexts([t, ...texts]); nav(`/reader/${t.id}`) }}
        />
      )}
    </div>
  )
}

function PassageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="8" y1="9" x2="10" y2="9" />
    </svg>
  )
}
