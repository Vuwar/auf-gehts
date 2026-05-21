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
  const [description, setDescription] = useState(set.description ?? '')
  const [isPublic, setIsPublic] = useState(set.isPublic)
  const [isOfficial, setIsOfficial] = useState(set.isOfficial)
  const [weekId, setWeekId] = useState(set.weekId ?? '')
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [wordsOpen, setWordsOpen] = useState(false)
  const [wordDrafts, setWordDrafts] = useState(words)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmWord, setConfirmWord] = useState<Word | null>(null)
  const [deleting, setDeleting] = useState(false)
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

  const hasSetChanges =
    name.trim() !== set.name ||
    description.trim() !== (set.description ?? '') ||
    isPublic !== set.isPublic ||
    (isAdmin && isOfficial !== set.isOfficial) ||
    (isAdmin && isOfficial && weekId !== (set.weekId ?? '')) ||
    (isAdmin && !isOfficial && set.weekId !== null) ||
    wordDrafts.some(draft => {
      const original = words.find(w => w.id === draft.id)
      return !original || (draft.front.trim() !== original.front || draft.back.trim() !== original.back)
    })

  const saveSet = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const updated = await api.updateSet(set.id, {
        name: name.trim(),
        description: description.trim(),
        isPublic,
        ...(isAdmin ? {
          isOfficial,
          weekId: isOfficial && weekId ? weekId : null,
          clearWeek: !isOfficial || !weekId,
        } : {}),
      })
      await Promise.all(wordDrafts.map(draft => {
        const original = words.find(w => w.id === draft.id)
        if (!original) return api.addWord(set.id, draft.front.trim(), draft.back.trim(), draft.context ?? undefined)
        if (draft.front.trim() === original.front && draft.back.trim() === original.back) return draft
        return api.updateWord(draft.id, draft.front.trim(), draft.back.trim(), draft.context ?? undefined)
      }))
      const updatedWords = await api.listWords(set.id)
      onSetUpdated(updated)
      onWordsChanged(updatedWords)
      onClose()
    } catch (e: unknown) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const addWord = (front: string, back: string) => {
    setWordDrafts([...wordDrafts, draftWord(set.id, front, back)])
  }

  const bulkAdd = (items: { front: string; back: string }[]) => {
    setWordDrafts([...wordDrafts, ...items.map(item => draftWord(set.id, item.front, item.back))])
  }

  const deleteWord = async () => {
    if (!confirmWord) return
    if (isDraftWord(confirmWord)) {
      setWordDrafts(wordDrafts.filter(w => w.id !== confirmWord.id))
      setConfirmWord(null)
      return
    }
    setDeleting(true)
    try {
      await api.deleteWord(confirmWord.id)
      onWordsChanged(words.filter(w => w.id !== confirmWord.id))
      setWordDrafts(wordDrafts.filter(w => w.id !== confirmWord.id))
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
            <span className="card-label">Name</span>
            <input type="text" value={name} onChange={e => setName(e.target.value)} />

            <span className="card-label">Description</span>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a short description"
            />
          </div>

          <button onClick={() => setIsPublic(!isPublic)} type="button" className="visibility-toggle">
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

              <button onClick={() => setIsOfficial(!isOfficial)} type="button" className="visibility-toggle">
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

          <button onClick={() => setAddOpen(!addOpen)} className="collapse-toggle">
            <span>Add words</span>
            <ChevronIcon open={addOpen} />
          </button>
          {addOpen && (
            <AddWordsPanel onAddSingle={addWord} onBulkAdd={bulkAdd} bufferCount={wordDrafts.filter(isDraftWord).length} />
          )}

          <button onClick={() => setWordsOpen(!wordsOpen)} className="collapse-toggle sticky-toggle">
            <span>Words ({wordDrafts.length})</span>
            <ChevronIcon open={wordsOpen} />
          </button>
          {wordsOpen && (
            <div className="collapse-content">
              {wordDrafts.length === 0 ? (
                <p className="empty-state" style={{ padding: '12px' }}>No words yet.</p>
              ) : (
                <ul className="word-list">
                  {wordDrafts.map(w => (
                    <EditableWordRow
                      key={w.id}
                      word={w}
                      onChange={(front, back) => setWordDrafts(wordDrafts.map(x => x.id === w.id ? { ...x, front, back } : x))}
                      onDelete={() => setConfirmWord(w)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}

          <div className="edit-action-row">
            {set.name === 'My Vocabulary' ? <span /> : (
            <button onClick={() => setConfirmingDelete(true)} className="deck-btn edit-delete-btn">
              <TrashIcon /> Delete set
            </button>
            )}
            <button onClick={saveSet} disabled={saving || !name.trim() || !hasSetChanges} className="deck-btn edit-save-btn">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
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

function EditableWordRow({ word, onChange, onDelete }: { word: Word; onChange: (front: string, back: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [front, setFront] = useState(word.front)
  const [back, setBack] = useState(word.back)

  const apply = () => {
    if (!front.trim() || !back.trim()) return
    onChange(front.trim(), back.trim())
    setEditing(false)
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
            <button onClick={apply} className="deck-btn primary" style={{ flex: 1 }}>Done</button>
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

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong'
}

function draftWord(wordSetId: string, front: string, back: string): Word {
  return {
    id: `draft:${crypto.randomUUID()}`,
    wordSetId,
    front,
    back,
    context: null,
    displayOrder: 0,
    createdAt: new Date().toISOString(),
  }
}

function isDraftWord(word: Word) {
  return word.id.startsWith('draft:')
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
