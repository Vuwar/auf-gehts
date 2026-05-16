import { useEffect, useState } from 'react'
import { api, parseBulkText, type Word, type WordSet } from '../api'

interface Props {
  set: WordSet
  words: Word[]
  onClose: () => void
  onSetUpdated: (set: WordSet) => void
  onWordsChanged: (words: Word[]) => void
  onDeleted: () => void
}

export default function EditSetSheet({ set, words, onClose, onSetUpdated, onWordsChanged, onDeleted }: Props) {
  const [name, setName] = useState(set.name)
  const [savingName, setSavingName] = useState(false)
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

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

  const addWord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFront.trim() || !newBack.trim()) return
    const w = await api.addWord(set.id, newFront.trim(), newBack.trim())
    onWordsChanged([...words, w])
    setNewFront(''); setNewBack('')
  }

  const bulkAdd = async () => {
    const parsed = parseBulkText(bulkText).filter(c => c.front && c.back)
    if (parsed.length === 0) { alert('Nothing valid'); return }
    await api.bulkAddWords(set.id, parsed)
    const fresh = await api.listWords(set.id)
    onWordsChanged(fresh)
    setBulkText(''); setShowBulk(false)
  }

  const deleteWord = async (id: string) => {
    await api.deleteWord(id)
    onWordsChanged(words.filter(w => w.id !== id))
  }

  const deleteSet = async () => {
    if (!confirm('Delete this set permanently? All words will be lost.')) return
    await api.deleteSet(set.id)
    onDeleted()
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
            <span className="card-label">Set name</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
              <button onClick={saveName} disabled={savingName || name.trim() === set.name || !name.trim()} className="deck-btn primary">
                {savingName ? '...' : 'Save'}
              </button>
            </div>
          </div>

          <div className="tab-toggle">
            <button onClick={() => setShowBulk(false)} className={`tab-toggle-btn ${!showBulk ? 'active' : ''}`}>Single Add</button>
            <button onClick={() => setShowBulk(true)} className={`tab-toggle-btn ${showBulk ? 'active' : ''}`}>Bulk Add</button>
          </div>

          {!showBulk ? (
            <form onSubmit={addWord} className="form-row">
              <input type="text" placeholder="German" value={newFront} onChange={e => setNewFront(e.target.value)} />
              <input type="text" placeholder="English" value={newBack} onChange={e => setNewBack(e.target.value)} />
              <button type="submit" className="deck-btn primary">Add word</button>
            </form>
          ) : (
            <div className="form-row">
              <p className="hint">One per line. Format: German - English</p>
              <textarea rows={6} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="der Hund - the dog" />
              <button onClick={bulkAdd} className="deck-btn primary">Save all</button>
            </div>
          )}

          <div>
            <span className="card-label" style={{ display: 'block', marginBottom: '8px' }}>Words ({words.length})</span>
            {words.length === 0 ? (
              <p className="empty-state" style={{ padding: '12px' }}>No words yet.</p>
            ) : (
              <ul className="word-list">
                {words.map(w => (
                  <li key={w.id} className="word-card">
                    <div className="word-card-body">
                      <div className="word-card-front">{w.front}</div>
                      <div className="word-card-back">{w.back}</div>
                    </div>
                    <button onClick={() => deleteWord(w.id)} className="word-card-delete" aria-label="Delete word">
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button onClick={deleteSet} className="deck-btn danger" style={{ marginTop: '8px', width: '100%', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
            <TrashIcon /> Delete set
          </button>
        </div>
      </div>
    </div>
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
