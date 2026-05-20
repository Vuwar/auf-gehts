import { useEffect, useState } from 'react'
import { api, type Week, type Word, type WordSet } from '../api'
import { useAuth } from '../auth'
import AddWordsPanel from './AddWordsPanel'
import ConfirmationDialog from './ConfirmationDialog'

interface Props {
  set: WordSet
  words: Word[]
  onClose: () => void
  onSetUpdated: (set: WordSet) => void
  onWordsChanged: (words: Word[]) => void
  onDeleted: () => void
}

export default function EditSetSheet({ set, words, onClose, onSetUpdated, onWordsChanged, onDeleted }: Props) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'
  const [weeks, setWeeks] = useState<Week[]>([])
  const [name, setName] = useState(set.name)
  const [savingName, setSavingName] = useState(false)
  const [description, setDescription] = useState(set.description ?? '')
  const [savingDescription, setSavingDescription] = useState(false)
  const [isPublic, setIsPublic] = useState(set.isPublic)
  const [togglingPublic, setTogglingPublic] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [wordsOpen, setWordsOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmWord, setConfirmWord] = useState<Word | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const setWeek = async (weekId: string) => {
    const updated = weekId
      ? await api.updateSet(set.id, { weekId })
      : await api.updateSet(set.id, { clearWeek: true })
    onSetUpdated(updated)
  }

  const toggleOfficial = async () => {
    const updated = await api.updateSet(set.id, { isOfficial: !set.isOfficial })
    onSetUpdated(updated)
  }

  const saveName = async () => {
    if (name.trim() === set.name || !name.trim()) return
    setSavingName(true)
    try {
      const updated = await api.updateSet(set.id, { name: name.trim() })
      onSetUpdated(updated)
    } finally {
      setSavingName(false)
    }
  }

  const saveDescription = async () => {
    const next = description.trim()
    if (next === (set.description ?? '')) return
    setSavingDescription(true)
    try {
      const updated = await api.updateSet(set.id, { description: next })
      onSetUpdated(updated)
    } finally {
      setSavingDescription(false)
    }
  }

  const togglePublic = async () => {
    setTogglingPublic(true)
    try {
      const next = !isPublic
      const updated = await api.updateSet(set.id, { isPublic: next })
      setIsPublic(next)
      onSetUpdated(updated)
    } finally {
      setTogglingPublic(false)
    }
  }

  const addWord = async (front: string, back: string) => {
    const w = await api.addWord(set.id, front, back)
    onWordsChanged([...words, w])
  }

  const bulkAdd = async (items: { front: string; back: string }[]) => {
    await api.bulkAddWords(set.id, items)
    const fresh = await api.listWords(set.id)
    onWordsChanged(fresh)
  }

  const deleteWord = async () => {
    if (!confirmWord) return
    setDeleting(true)
    try {
      await api.deleteWord(confirmWord.id)
      onWordsChanged(words.filter(w => w.id !== confirmWord.id))
      setConfirmWord(null)
    } finally {
      setDeleting(false)
    }
  }

  const deleteSet = async () => {
    setDeleting(true)
    try {
      await api.deleteSet(set.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>Edit set</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>

        <div className="sheet-body">
          <div className="form-row">
            <span className="card-label">Change name</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
              <button onClick={saveName} disabled={savingName || name.trim() === set.name || !name.trim()} className="deck-btn primary">
                {savingName ? '...' : 'Save'}
              </button>
            </div>
          </div>

          <div className="form-row">
            <span className="card-label">Description</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add a short description"
                style={{ flex: 1 }}
              />
              <button
                onClick={saveDescription}
                disabled={savingDescription || description.trim() === (set.description ?? '')}
                className="deck-btn primary"
              >
                {savingDescription ? '...' : 'Save'}
              </button>
            </div>
          </div>

          <button onClick={togglePublic} disabled={togglingPublic} className="visibility-toggle">
            <div className="visibility-toggle-text">
              <span className="visibility-toggle-title">{isPublic ? 'Public' : 'Private'}</span>
              <span className="visibility-toggle-sub">{isPublic ? 'Anyone can see this set' : 'Only you can see this set'}</span>
            </div>
            <span className={`visibility-switch ${isPublic ? 'on' : ''}`}>
              <span className="visibility-switch-knob" />
            </span>
          </button>

          {isAdmin && (
            <div className="form-row" style={{ borderColor: 'var(--accent-border)' }}>
              <span className="card-label" style={{ color: 'var(--accent)' }}>Admin</span>

              <button onClick={toggleOfficial} type="button" className="visibility-toggle">
                <div className="visibility-toggle-text">
                  <span className="visibility-toggle-title">Official set</span>
                  <span className="visibility-toggle-sub">Shows in Abenteuer week page</span>
                </div>
                <span className={`visibility-switch ${set.isOfficial ? 'on' : ''}`}>
                  <span className="visibility-switch-knob" />
                </span>
              </button>

              {set.isOfficial && (
                <>
                  <span className="card-label">Assign to week</span>
                  <select value={set.weekId ?? ''} onChange={e => setWeek(e.target.value)}>
                    <option value="">Choose a week</option>
                    {weeks.map(w => <option key={w.id} value={w.id}>Woche {w.number}: {w.title}</option>)}
                  </select>
                </>
              )}
            </div>
          )}

          <button onClick={() => setAddOpen(!addOpen)} className="collapse-toggle">
            <span>Add words</span>
            <ChevronIcon open={addOpen} />
          </button>
          {addOpen && (
            <AddWordsPanel onAddSingle={addWord} onBulkAdd={bulkAdd} />
          )}

          <button onClick={() => setWordsOpen(!wordsOpen)} className="collapse-toggle sticky-toggle">
            <span>Words ({words.length})</span>
            <ChevronIcon open={wordsOpen} />
          </button>
          {wordsOpen && (
            <div className="collapse-content">
              {words.length === 0 ? (
                <p className="empty-state" style={{ padding: '12px' }}>No words yet.</p>
              ) : (
                <ul className="word-list">
                  {words.map(w => (
                    <EditableWordRow
                      key={w.id}
                      word={w}
                      onSave={async (front, back) => {
                        const updated = await api.updateWord(w.id, front, back, w.context ?? undefined)
                        onWordsChanged(words.map(x => x.id === w.id ? updated : x))
                      }}
                      onDelete={() => setConfirmWord(w)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {set.name === 'My Vocabulary' ? null : (
            <button onClick={() => setConfirmingDelete(true)} className="deck-btn danger" style={{ marginTop: '8px', width: '100%', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
              <TrashIcon /> Delete set
            </button>
          )}
          <ConfirmationDialog
            open={confirmingDelete}
            title="Delete set?"
            message={`"${set.name}" and its words will be permanently deleted.`}
            confirmLabel="Delete set"
            busy={deleting}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={deleteSet}
          />
          <ConfirmationDialog
            open={!!confirmWord}
            title="Delete word?"
            message={`"${confirmWord?.front ?? 'This word'}" will be permanently removed from this set.`}
            confirmLabel="Delete word"
            busy={deleting}
            onCancel={() => setConfirmWord(null)}
            onConfirm={deleteWord}
          />
        </div>
      </div>
    </div>
  )
}

function EditableWordRow({ word, onSave, onDelete }: { word: Word; onSave: (front: string, back: string) => Promise<void>; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [front, setFront] = useState(word.front)
  const [back, setBack] = useState(word.back)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!front.trim() || !back.trim()) return
    if (front === word.front && back === word.back) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(front.trim(), back.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setFront(word.front); setBack(word.back); setEditing(false)
  }

  if (editing) {
    return (
      <li className="word-card word-card-editing">
        <div className="word-card-body">
          <input value={front} onChange={e => setFront(e.target.value)} />
          <input value={back} onChange={e => setBack(e.target.value)} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} disabled={saving} className="deck-btn primary" style={{ flex: 1 }}>{saving ? '...' : 'Save'}</button>
            <button onClick={cancel} className="deck-btn">Cancel</button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className="word-card" onClick={() => setEditing(true)} style={{ cursor: 'pointer' }}>
      <div className="word-card-body">
        <div className="word-card-front">{word.front}</div>
        <div className="word-card-back">{word.back}</div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="word-card-delete" aria-label="Delete word">
        <TrashIcon />
      </button>
    </li>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
