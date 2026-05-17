import { useEffect, useState } from 'react'
import { api, type Week } from '../api'
import { useAuth } from '../auth'

interface Props {
  onClose: () => void
  onCreated: (slug: string) => void
}

export default function CreateSetSheet({ onClose, onCreated }: Props) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'
  const [weeks, setWeeks] = useState<Week[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('A1')
  const [weekId, setWeekId] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isOfficial, setIsOfficial] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (isAdmin) api.listWeeks().then(setWeeks).catch(() => {})
  }, [isAdmin])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError(null)
    try {
      const set = await api.createSet({
        name: name.trim(),
        description: description.trim() || undefined,
        level,
        isPublic,
        isOfficial: isAdmin && isOfficial,
        weekId: isAdmin ? (weekId || undefined) : undefined,
      })
      onCreated(set.slug)
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>Create set</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>
        <div className="sheet-body">
          <form onSubmit={submit} className="form-row">
            <span className="card-label">Name</span>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />

            <span className="card-label">Description</span>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} />

            <span className="card-label">Level</span>
            <select value={level} onChange={e => setLevel(e.target.value)}>
              <option value="A1">A1</option><option value="A2">A2</option>
              <option value="B1">B1</option><option value="B2">B2</option>
              <option value="C1">C1</option><option value="C2">C2</option>
            </select>

            <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
              <span>Public (visible to everyone)</span>
            </label>

            {isAdmin && (
              <>
                <span className="card-label">Admin: assign to week</span>
                <select value={weekId} onChange={e => setWeekId(e.target.value)}>
                  <option value="">Choose a week</option>
                  {weeks.map(w => <option key={w.id} value={w.id}>Woche {w.number}: {w.title}</option>)}
                </select>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="checkbox" checked={isOfficial} onChange={e => setIsOfficial(e.target.checked)} />
                  <span>Make official</span>
                </label>
              </>
            )}

            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}

            <button type="submit" disabled={saving || !name.trim()} className="deck-btn primary">
              {saving ? 'Creating...' : 'Create'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
