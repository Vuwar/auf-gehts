import { useEffect, useState } from 'react'
import { api, type Week } from '../api'
import { useAuth } from '../auth'
import AddWordsPanel from './AddWordsPanel'

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
  const [addOpen, setAddOpen] = useState(false)
  const [wordBuffer, setWordBuffer] = useState<{ front: string; back: string }[]>([])

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
        weekId: isAdmin && isOfficial ? (weekId || undefined) : undefined,
      })
      if (wordBuffer.length > 0) {
        try {
          await api.bulkAddWords(set.id, wordBuffer)
        } catch (err) {
          console.error('Failed to add queued words', err)
        }
      }
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

            <button type="button" onClick={() => setIsPublic(!isPublic)} className="visibility-toggle">
              <div className="visibility-toggle-text">
                <span className="visibility-toggle-title">{isPublic ? 'Public' : 'Private'}</span>
                <span className="visibility-toggle-sub">{isPublic ? 'Visible to everyone' : 'Only visible to you'}</span>
              </div>
              <span className={`visibility-switch ${isPublic ? 'on' : ''}`}>
                <span className="visibility-switch-knob" />
              </span>
            </button>

            {isAdmin && (
              <div className="form-row" style={{ borderColor: 'var(--accent-border)' }}>
                <span className="card-label" style={{ color: 'var(--accent)' }}>Admin</span>

                <button type="button" onClick={() => setIsOfficial(!isOfficial)} className="visibility-toggle">
                  <div className="visibility-toggle-text">
                    <span className="visibility-toggle-title">Official set</span>
                    <span className="visibility-toggle-sub">Shows in Abenteuer week page</span>
                  </div>
                  <span className={`visibility-switch ${isOfficial ? 'on' : ''}`}>
                    <span className="visibility-switch-knob" />
                  </span>
                </button>

                {isOfficial && (
                  <>
                    <span className="card-label">Assign to week</span>
                    <select value={weekId} onChange={e => setWeekId(e.target.value)}>
                      <option value="">Choose a week</option>
                      {weeks.map(w => <option key={w.id} value={w.id}>Woche {w.number}: {w.title}</option>)}
                    </select>
                  </>
                )}
              </div>
            )}

            <button type="button" onClick={() => setAddOpen(!addOpen)} className="collapse-toggle">
              <span>Add words {wordBuffer.length > 0 ? `(${wordBuffer.length})` : ''}</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: addOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {addOpen && (
              <AddWordsPanel
                onAddSingle={(front, back) => { setWordBuffer(prev => [...prev, { front, back }]) }}
                onBulkAdd={(items) => { setWordBuffer(prev => [...prev, ...items]) }}
                bufferCount={wordBuffer.length}
              />
            )}

            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}

            <button type="submit" disabled={saving || !name.trim()} className="deck-btn primary">
              {saving ? 'Creating...' : (wordBuffer.length > 0 ? `Create + add ${wordBuffer.length} words` : 'Create')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
