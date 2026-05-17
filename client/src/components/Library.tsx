import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Library as LibraryData, type Week, type WordSet } from '../api'
import { useAuth } from '../auth'
import ErrorView from './ErrorView'

export default function Library() {
  const nav = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'
  const canCreate = profile?.role !== 'ViewOnly'

  const [data, setData] = useState<LibraryData | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [creating, setCreating] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)

  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newLevel, setNewLevel] = useState('A1')
  const [newWeekId, setNewWeekId] = useState<string>('')
  const [newIsPublic, setNewIsPublic] = useState(false)
  const [newIsOfficial, setNewIsOfficial] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [lib, ws] = await Promise.all([api.getLibrary(), api.listWeeks()])
      setData(lib); setWeeks(ws)
    } catch (e) {
      setError(e)
    } finally { setLoading(false) }
  }

  const createSet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const set = await api.createSet({
      weekId: isAdmin ? (newWeekId || undefined) : undefined,
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      level: newLevel,
      isPublic: newIsPublic,
      isOfficial: isAdmin && newIsOfficial,
    })
    setCreating(false)
    setNewName(''); setNewDesc(''); setNewWeekId(''); setNewLevel('A1'); setNewIsPublic(false); setNewIsOfficial(false)
    nav(`/sets/${set.slug}`)
  }

  if (loading) return <div className="deck"><p className="empty-state">Loading...</p></div>
  if (error) return <div className="deck"><ErrorView error={error} onRetry={load} /></div>
  if (!data) return null

  return (
    <div className="deck">
      <div className="deck-header">
        <h1>Library</h1>
        {canCreate && (
          <button onClick={() => setCreating(!creating)} className="deck-btn primary">
            {creating ? 'Cancel' : '+ Create set'}
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={createSet} className="form-row">
          <span className="card-label">Name</span>
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required />

          <span className="card-label">Description</span>
          <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} />

          <span className="card-label">Level</span>
          <select value={newLevel} onChange={e => setNewLevel(e.target.value)}>
            <option value="A1">A1</option><option value="A2">A2</option>
            <option value="B1">B1</option><option value="B2">B2</option>
            <option value="C1">C1</option><option value="C2">C2</option>
          </select>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="checkbox" checked={newIsPublic} onChange={e => setNewIsPublic(e.target.checked)} />
            <span>Public (visible to everyone)</span>
          </label>

          {isAdmin && (
            <>
              <span className="card-label">Admin: assign to week</span>
              <select value={newWeekId} onChange={e => setNewWeekId(e.target.value)}>
                <option value="">Choose a week</option>
                {weeks.map(w => <option key={w.id} value={w.id}>Woche {w.number}: {w.title}</option>)}
              </select>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="checkbox" checked={newIsOfficial} onChange={e => setNewIsOfficial(e.target.checked)} />
                <span>Make official (appears in Abenteuer week)</span>
              </label>
            </>
          )}

          <button type="submit" className="deck-btn primary">Create</button>
        </form>
      )}

      <Section title="Favorites" sets={data.favorites} emptyMsg="No favorites yet. Tap the heart on any set." onClick={s => nav(`/sets/${s.slug}`)} />
      <Section title="My sets" sets={data.mine} emptyMsg="You haven't created any sets yet." onClick={s => nav(`/sets/${s.slug}`)} />

      <CollapsibleSection title="Completed" sets={data.completed} emptyMsg="No completed sets yet." onClick={s => nav(`/sets/${s.slug}`)} open={completedOpen} onToggle={() => setCompletedOpen(!completedOpen)} />
      <CollapsibleSection title="Browse sets" sets={data.browse} emptyMsg="No other public sets right now." onClick={s => nav(`/sets/${s.slug}`)} open={browseOpen} onToggle={() => setBrowseOpen(!browseOpen)} />
    </div>
  )
}

function Section({ title, sets, emptyMsg, onClick }: { title: string; sets: WordSet[]; emptyMsg: string; onClick: (s: WordSet) => void }) {
  return (
    <>
      <h2 className="section-title">{title} <span className="hint">({sets.length})</span></h2>
      {sets.length === 0 ? (
        <p className="hint">{emptyMsg}</p>
      ) : (
        <ul className="deck-list">
          {sets.map(s => <SetRow key={s.id} set={s} onClick={onClick} />)}
        </ul>
      )}
    </>
  )
}

function CollapsibleSection(props: { title: string; sets: WordSet[]; emptyMsg: string; onClick: (s: WordSet) => void; open: boolean; onToggle: () => void }) {
  return (
    <>
      <button onClick={props.onToggle} className="collapse-toggle">
        <span>{props.title} <span className="hint">({props.sets.length})</span></span>
        <span style={{ transform: props.open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-flex' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {props.open && (
        <div className="collapse-content">
          {props.sets.length === 0 ? (
            <p className="hint" style={{ padding: '8px 4px' }}>{props.emptyMsg}</p>
          ) : (
            <ul className="deck-list">
              {props.sets.map(s => <SetRow key={s.id} set={s} onClick={props.onClick} />)}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

function SetRow({ set, onClick }: { set: WordSet; onClick: (s: WordSet) => void }) {
  return (
    <li className="deck-item">
      <button onClick={() => onClick(set)} className="deck-item-main">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{set.name}</span>
          {set.isFavorite && <span className="starter-level" title="Favorited">♥</span>}
          {set.isOwner && <span className="starter-level" title="Your set">Mine</span>}
          {set.weekNumber && <span className="starter-level">W{set.weekNumber}</span>}
          {set.level && <span className="starter-level">{set.level}</span>}
          {!set.isPublic && <span className="starter-level">private</span>}
          <span className="deck-item-count">· {set.wordCount} words</span>
        </div>
      </button>
    </li>
  )
}
