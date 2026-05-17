import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type ReadingText } from '../api'
import CreateTextSheet from './CreateTextSheet'

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
        <p className="empty-state">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No texts yet. Tap + to add one.</p>
      ) : (
        <ul className="deck-list">
          {filtered.map(t => (
            <li key={t.id} className="deck-item">
              <button onClick={() => nav(`/reader/${t.id}`)} className="deck-item-main">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{t.title}</strong>
                  {t.level && <span className="starter-level">{t.level}</span>}
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
