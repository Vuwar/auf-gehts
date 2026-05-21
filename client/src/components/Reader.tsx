import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type ReadingText } from '../api'
import { useAuth } from '../auth'
import CreateTextSheet from './CreateTextSheet'
import { ListSkeleton } from './Skeletons'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
type AudioFilter = 'all' | 'audio'
type TypeFilter = 'all' | 'official' | 'community'

export default function Reader() {
  const nav = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'
  const [texts, setTexts] = useState<ReadingText[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string | null>(null)
  const [audioFilter, setAudioFilter] = useState<AudioFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [creating, setCreating] = useState(false)

  const load = () => {
    setLoading(true)
    api.listReadingTexts().then(setTexts).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return texts.filter(t => {
      if (!isAdmin && !t.isUnlocked) return false
      if (levelFilter && t.level !== levelFilter) return false
      if (audioFilter === 'audio' && !t.audioUrl) return false
      if (typeFilter === 'official' && t.weekId === null) return false
      if (typeFilter === 'community' && t.weekId !== null) return false
      if (!q) return true
      return t.title.toLowerCase().includes(q) || (t.createdByName?.toLowerCase().includes(q) ?? false)
    })
  }, [texts, search, levelFilter, audioFilter, typeFilter, isAdmin])

  return (
    <div className="deck">
      <div className="deck-header">
        <div>
          <h1>Reader</h1>
          <span className="deck-progress">German texts to read and practice</span>
        </div>
      </div>

      <div className="reader-filter-panel">
        <div className="reader-search-wrap">
          <svg className="reader-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search texts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="reader-search-input"
          />
          {search && (
            <button className="reader-search-clear offline-allow" onClick={() => setSearch('')} aria-label="Clear search">×</button>
          )}
        </div>

        <div className="reader-filter-divider" />

        <div className="reader-filter-row">
          <span className="reader-filter-label">Level</span>
          <div className="filter-chips">
            <button onClick={() => setLevelFilter(null)} className={`filter-chip offline-allow ${levelFilter === null ? 'active' : ''}`}>All</button>
            {LEVELS.map(lv => (
              <button key={lv} onClick={() => setLevelFilter(levelFilter === lv ? null : lv)} className={`filter-chip offline-allow ${levelFilter === lv ? 'active' : ''}`}>{lv}</button>
            ))}
          </div>
        </div>

        <div className="reader-filter-row">
          <span className="reader-filter-label">Source</span>
          <div className="filter-chips">
            {(['all', 'official', 'community'] as TypeFilter[]).map(v => (
              <button key={v} onClick={() => setTypeFilter(v)} className={`filter-chip offline-allow ${typeFilter === v ? 'active' : ''}`}>
                {v === 'all' ? 'All' : v === 'official' ? '📚 Official' : 'Community'}
              </button>
            ))}
          </div>
        </div>

        <div className="reader-filter-row">
          <span className="reader-filter-label">Audio</span>
          <div className="filter-chips">
            <button onClick={() => setAudioFilter('all')} className={`filter-chip offline-allow ${audioFilter === 'all' ? 'active' : ''}`}>All</button>
            <button onClick={() => setAudioFilter('audio')} className={`filter-chip offline-allow ${audioFilter === 'audio' ? 'active' : ''}`}>🎧 With audio</button>
          </div>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <p className="empty-state">{texts.length === 0 ? 'No texts yet.' : 'No texts match filters.'}</p>
      ) : (
        <ul className="reader-list">
          {filtered.map(t => (
            <li key={t.id}>
              <button onClick={() => nav(`/reader/${t.id}`)} className="reader-text-card">
                <div className="reader-text-card-body">
                  <div className="reader-text-card-top">
                    <span className="reader-text-card-title">{t.title}</span>
                    <div className="reader-text-card-badges">
                      {t.level && <span className="starter-level">{t.level}</span>}
                      {t.weekId !== null && <span className="reader-official-badge">Official</span>}
                      {t.audioUrl && <span className="reader-audio-badge" aria-label="Has audio">🎧</span>}
                      {t.questions.length > 0 && <span className="reader-q-badge">{t.questions.length} Q</span>}
                    </div>
                  </div>
                  <div className="reader-text-card-sub">
                    <span>{t.createdByName ?? 'Unknown'}</span>
                    <span>·</span>
                    <span>{Math.max(1, Math.round(t.content.length / 900))} min read</span>
                    {t.weekNumber && <><span>·</span><span>Woche {t.weekNumber}</span></>}
                  </div>
                </div>
                <ChevronIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="reader-fab" onClick={() => setCreating(true)} aria-label="Create new text">+</button>

      {creating && (
        <CreateTextSheet
          onClose={() => setCreating(false)}
          onCreated={t => { setCreating(false); setTexts([t, ...texts]); nav(`/reader/${t.id}`) }}
        />
      )}
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, opacity: 0.35 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
