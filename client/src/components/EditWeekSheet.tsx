import { useEffect, useState } from 'react'
import { api, type WeekDetail } from '../api'
import ConfirmationDialog from './ConfirmationDialog'

interface Props {
  week: WeekDetail
  onClose: () => void
  onUpdated: () => void
  onDeleted: () => void
}

export default function EditWeekSheet({ week, onClose, onUpdated, onDeleted }: Props) {
  const [number, setNumber] = useState(week.number)
  const [title, setTitle] = useState(week.title)
  const [description, setDescription] = useState(week.description ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
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

  const hasChanges =
    number !== week.number ||
    title.trim() !== week.title ||
    description.trim() !== (week.description ?? '')

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.updateWeek(week.id, { number, title: title.trim(), description: description.trim() || undefined })
      onUpdated()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const deleteWeek = async () => {
    try {
      await api.deleteWeek(week.id)
      onDeleted()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>Edit week</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>

        <div className="sheet-body">
          <div className="form-row">
            <span className="card-label">Number</span>
            <input type="number" value={number} onChange={e => setNumber(Number(e.target.value))} min={1} />

            <span className="card-label">Title</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} />

            <span className="card-label">Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />

            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}
          </div>

          <div className="edit-action-row">
            <button onClick={() => setConfirmingDelete(true)} className="deck-btn edit-delete-btn">
              Delete week
            </button>
            <button
              onClick={save}
              disabled={saving || !title.trim() || !hasChanges}
              className="deck-btn edit-save-btn"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>

          <ConfirmationDialog
            open={confirmingDelete}
            title="Delete week?"
            message={`Woche ${week.number}: ${week.title} will be permanently deleted.`}
            confirmLabel="Delete week"
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={deleteWeek}
          />
        </div>
      </div>
    </div>
  )
}
