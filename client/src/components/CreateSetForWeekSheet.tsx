import { useEffect, useState } from 'react'
import { api } from '../api'

interface Props {
  weekId: string
  onClose: () => void
  onCreated: () => void
}

export default function CreateSetForWeekSheet({ weekId, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('A1')
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

  const save = async () => {
    if (!name.trim()) return
    setSaving(true); setError(null)
    try {
      await api.createSet({
        name: name.trim(),
        description: description.trim() || undefined,
        level,
        isPublic: true,
        isOfficial: true,
        weekId,
      })
      onCreated()
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
          <h2>New set for this week</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>
        <div className="sheet-body">
          <div className="form-row">
            <span className="card-label">Name</span>
            <input type="text" value={name} onChange={e => setName(e.target.value)} />

            <span className="card-label">Description</span>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} />

            <span className="card-label">Level</span>
            <select value={level} onChange={e => setLevel(e.target.value)}>
              <option value="A1">A1</option><option value="A2">A2</option>
              <option value="B1">B1</option><option value="B2">B2</option>
              <option value="C1">C1</option><option value="C2">C2</option>
            </select>

            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}

            <button onClick={save} disabled={saving || !name.trim()} className="deck-btn primary">
              {saving ? 'Creating...' : 'Create set'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
