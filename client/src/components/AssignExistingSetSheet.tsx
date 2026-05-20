import { useEffect, useState } from 'react'
import { api, type WordSet } from '../api'
import { ListSkeleton } from './Skeletons'

interface Props {
  weekId: string
  onClose: () => void
  onAssigned: () => void
}

export default function AssignExistingSetSheet({ weekId, onClose, onAssigned }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WordSet[]>([])
  const [loading, setLoading] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignedOpen, setAssignedOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    const id = setTimeout(async () => {
      setLoading(true)
      try { setResults(await api.searchSets(query.trim())) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(id)
  }, [query])

  const assign = async (set: WordSet) => {
    setAssigningId(set.id)
    try {
      await api.updateSet(set.id, { weekId, isOfficial: true })
      onAssigned()
      onClose()
    } finally {
      setAssigningId(null)
    }
  }

  const unassigned = results.filter(s => !s.weekNumber)
  const assigned = results.filter(s => s.weekNumber)

  const Row = (s: WordSet) => (
    <li key={s.id} className="deck-item">
      <div className="deck-item-main" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <strong style={{ fontSize: '14px' }}>{s.name}</strong>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
          {s.level && <span className="starter-level">{s.level}</span>}
          {s.weekNumber && <span className="starter-level">Already W{s.weekNumber}</span>}
          {s.isOfficial && <span className="starter-level">official</span>}
          <span className="hint" style={{ fontSize: '12px' }}>{s.wordCount} words</span>
        </div>
      </div>
      <button onClick={() => assign(s)} disabled={assigningId === s.id} className="deck-btn primary">
        {assigningId === s.id ? '...' : 'Assign'}
      </button>
    </li>
  )

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>Assign existing set</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>
        <div className="sheet-body">
          <input
            type="text"
            placeholder="Search public sets by name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <p className="hint">Pick any public set and mark it as official under this week.</p>

          {loading ? (
            <ListSkeleton rows={4} />
          ) : results.length === 0 ? (
            <p className="empty-state">No matches.</p>
          ) : (
            <>
              <div className="section-header" style={{ marginTop: '4px' }}>
                <span className="section-title">Unassigned <span className="hint">({unassigned.length})</span></span>
              </div>
              {unassigned.length === 0 ? (
                <p className="hint">All matching sets already belong to a week.</p>
              ) : (
                <ul className="deck-list">{unassigned.map(Row)}</ul>
              )}

              {assigned.length > 0 && (
                <>
                  <button onClick={() => setAssignedOpen(!assignedOpen)} className="section-header section-header-toggle" style={{ marginTop: '12px' }}>
                    <span className="section-title">Already assigned <span className="hint">({assigned.length})</span></span>
                    <span style={{ transform: assignedOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-flex' }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </button>
                  {assignedOpen && <ul className="deck-list">{assigned.map(Row)}</ul>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
