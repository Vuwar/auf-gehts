import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Library as LibraryData, type Week, type WordSet } from '../api'

export default function Library() {
  const nav = useNavigate()
  const [data, setData] = useState<LibraryData | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newLevel, setNewLevel] = useState('A1')
  const [newWeekId, setNewWeekId] = useState<string>('')
  const [newIsPublic, setNewIsPublic] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [lib, ws] = await Promise.all([api.getLibrary(), api.listWeeks()])
      setData(lib); setWeeks(ws)
    } finally { setLoading(false) }
  }

  const createSet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const set = await api.createSet({
      weekId: newWeekId || undefined,
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      level: newLevel,
      isPublic: newIsPublic,
    })
    setCreating(false)
    setNewName(''); setNewDesc(''); setNewWeekId(''); setNewLevel('A1'); setNewIsPublic(false)
    nav(`/sets/${set.slug}`)
  }

  if (loading || !data) return <div className="deck"><p className="empty-state">Loading...</p></div>

  return (
    <div className="deck">
      <div className="deck-header">
        <h1>Library</h1>
        <button onClick={() => setCreating(!creating)} className="deck-btn primary">
          {creating ? 'Cancel' : '+ Create set'}
        </button>
      </div>

      {creating && (
        <form onSubmit={createSet} className="form-row">
          <span className="card-label">Week (optional)</span>
          <select value={newWeekId} onChange={e => setNewWeekId(e.target.value)}>
            <option value="">— no week —</option>
            {weeks.map(w => <option key={w.id} value={w.id}>Woche {w.number}: {w.title}</option>)}
          </select>

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

          <button type="submit" className="deck-btn primary">Create</button>
        </form>
      )}

      <Section title="Active" sets={data.active} emptyMsg="No sets in progress. Start studying from Abenteuer." onClick={(s) => nav(`/sets/${s.slug}`)} />
      <Section title="Completed" sets={data.completed} emptyMsg="No completed sets yet." onClick={(s) => nav(`/sets/${s.slug}`)} />
      <Section title="My sets" sets={data.mine} emptyMsg="You haven't created any sets yet." onClick={(s) => nav(`/sets/${s.slug}`)} />
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
          {sets.map(s => (
            <li key={s.id} className="deck-item">
              <button onClick={() => onClick(s)} className="deck-item-main">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span>{s.name}</span>
                  {s.weekNumber && <span className="starter-level">W{s.weekNumber}</span>}
                  {s.level && <span className="starter-level">{s.level}</span>}
                  {!s.isPublic && <span className="starter-level">private</span>}
                  <span className="deck-item-count">· {s.wordCount} words</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
