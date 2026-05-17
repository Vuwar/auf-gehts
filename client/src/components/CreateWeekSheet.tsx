import { useEffect, useState } from 'react'
import { api } from '../api'

interface Props {
  nextNumber: number
  onClose: () => void
  onCreated: () => void
}

export default function CreateWeekSheet({ nextNumber, onClose, onCreated }: Props) {
  const [number, setNumber] = useState(nextNumber)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true); setError(null)
    try {
      await api.createWeek(number, title.trim(), description.trim() || undefined)
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
          <h2>New week</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>
        <div className="sheet-body">
          <form onSubmit={submit} className="form-row">
            <span className="card-label">Number</span>
            <input type="number" min={1} value={number} onChange={e => setNumber(Number(e.target.value))} />

            <span className="card-label">Title</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />

            <span className="card-label">Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />

            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}

            <button type="submit" disabled={saving || !title.trim()} className="deck-btn primary">
              {saving ? 'Creating...' : 'Create week'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
