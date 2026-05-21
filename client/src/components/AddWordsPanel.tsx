import { useState } from 'react'
import { parseBulkText } from '../api'

interface Props {
  onAddSingle: (front: string, back: string) => Promise<void> | void
  onBulkAdd: (items: { front: string; back: string }[]) => Promise<void> | void
  bufferCount?: number
}

export default function AddWordsPanel({ onAddSingle, onBulkAdd, bufferCount }: Props) {
  const [showBulk, setShowBulk] = useState(false)
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [busy, setBusy] = useState(false)

  const addSingle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFront.trim() || !newBack.trim()) return
    setBusy(true)
    try {
      await onAddSingle(newFront.trim(), newBack.trim())
      setNewFront('')
      setNewBack('')
    } finally {
      setBusy(false)
    }
  }

  const addBulk = async () => {
    const parsed = parseBulkText(bulkText).filter(c => c.front && c.back)
    if (parsed.length === 0) { alert('Nothing valid'); return }
    setBusy(true)
    try {
      await onBulkAdd(parsed)
      setBulkText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="collapse-content">
      <div className="tab-toggle">
        <button type="button" onClick={() => setShowBulk(false)} className={`tab-toggle-btn ${!showBulk ? 'active' : ''}`}>Single</button>
        <button type="button" onClick={() => setShowBulk(true)} className={`tab-toggle-btn ${showBulk ? 'active' : ''}`}>Multiple</button>
      </div>
      {!showBulk ? (
        <form onSubmit={addSingle} className="form-row">
          <input type="text" placeholder="German" value={newFront} onChange={e => setNewFront(e.target.value)} />
          <input type="text" placeholder="English" value={newBack} onChange={e => setNewBack(e.target.value)} />
          <button type="submit" disabled={busy} className="deck-btn primary">Add word</button>
        </form>
      ) : (
        <div className="form-row">
          <p className="hint">One per line. Format: German - English</p>
          <textarea rows={6} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="der Hund - the dog" />
          <button type="button" onClick={addBulk} disabled={busy} className="deck-btn primary">Save all</button>
        </div>
      )}
      {typeof bufferCount === 'number' && bufferCount > 0 && (
        <p className="hint">{bufferCount} word{bufferCount === 1 ? '' : 's'} queued - press Save to commit</p>
      )}
    </div>
  )
}
