import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, parseBulkText, type Word, type WordSet } from '../api'
import FlashCard from './FlashCard'

type View = 'list' | 'study'

export default function WordSetView() {
  const { setSlug } = useParams<{ setSlug: string }>()
  const setId = setSlug
  const nav = useNavigate()
  const [set, setSet] = useState<WordSet | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [view, setView] = useState<View>('list')
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [showBulk, setShowBulk] = useState(false)

  useEffect(() => {
    if (!setId) return
    Promise.all([api.getSet(setId), api.listWords(setId)])
      .then(([s, w]) => { setSet(s); setWords(w) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [setId])

  const startStudy = async () => {
    if (!setId || !set) return
    setIndex(0)
    setView('study')
    if (set.progressStatus === 'NotStarted') {
      await api.setProgress(setId, 'Active')
      setSet({ ...set, progressStatus: 'Active' })
    }
  }

  const markComplete = async () => {
    if (!setId || !set) return
    await api.setProgress(setId, 'Completed')
    setSet({ ...set, progressStatus: 'Completed' })
  }

  const markActive = async () => {
    if (!setId || !set) return
    await api.setProgress(setId, 'Active')
    setSet({ ...set, progressStatus: 'Active' })
  }

  const addWord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!setId || !newFront.trim() || !newBack.trim()) return
    const word = await api.addWord(setId, newFront.trim(), newBack.trim())
    setWords([...words, word])
    setNewFront(''); setNewBack('')
  }

  const deleteWord = async (id: string) => {
    await api.deleteWord(id)
    setWords(words.filter(w => w.id !== id))
  }

  const bulkAdd = async () => {
    if (!setId) return
    const parsed = parseBulkText(bulkText).filter(c => c.front && c.back)
    if (parsed.length === 0) { alert('Nothing valid'); return }
    await api.bulkAddWords(setId, parsed)
    setWords(await api.listWords(setId))
    setBulkText(''); setShowBulk(false)
  }

  const deleteSet = async () => {
    if (!setId || !confirm('Delete this set?')) return
    await api.deleteSet(setId)
    nav('/library')
  }

  if (loading) return <div className="deck"><p className="empty-state">Loading...</p></div>
  if (error) return <div className="deck"><p className="empty-state" style={{ color: 'var(--danger)' }}>{error}</p></div>
  if (!set) return null

  if (view === 'study') {
    const card = words[index]
    const isLast = index === words.length - 1
    return (
      <div className="deck">
        <div>
          <button onClick={() => setView('list')} className="deck-btn">← Back to set</button>
        </div>
        <div className="deck-header">
          <h1>{set.name}</h1>
          {words.length > 0 && <span className="deck-progress">{index + 1} / {words.length}</span>}
        </div>

        {words.length === 0 ? (
          <p className="empty-state">No words.</p>
        ) : (
          <div className="card-section">
            <FlashCard key={card.id} front={card.front} back={card.back} />
            {card.context && (
              <div className="reader-context" style={{ maxWidth: '480px', width: '100%' }}>
                <span className="card-label">Context</span>
                <p>{card.context}</p>
              </div>
            )}
            <div className="deck-controls">
              <button onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0} className="deck-btn">← Previous</button>
              {isLast && set.progressStatus !== 'Completed' ? (
                <button onClick={markComplete} className="deck-btn primary">Mark complete ✓</button>
              ) : (
                <button onClick={() => setIndex(i => Math.min(words.length - 1, i + 1))} disabled={isLast} className="deck-btn">Next →</button>
              )}
            </div>
            <div className="deck-dots">
              {words.map((_, i) => (
                <button key={i} className={`dot ${i === index ? 'dot-active' : ''}`} onClick={() => setIndex(i)} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="deck">
      <div>
        <button onClick={() => nav(-1)} className="deck-btn">← Back</button>
      </div>
      <div className="deck-header">
        <div>
          <h1>{set.name}</h1>
          <p className="hint">
            {set.weekNumber && <>Woche {set.weekNumber} · </>}
            {set.level && <>{set.level} · </>}
            {set.isPublic ? 'Public' : 'Private'} · {words.length} words
            {set.progressStatus === 'Completed' && <span style={{ color: 'var(--accent)', marginLeft: '8px' }}>✓ Completed</span>}
            {set.progressStatus === 'Active' && <span style={{ color: 'var(--accent)', marginLeft: '8px' }}>◐ In progress</span>}
          </p>
          {set.description && <p>{set.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {words.length > 0 && (
            <button onClick={startStudy} className="deck-btn primary">Study →</button>
          )}
          {set.progressStatus === 'Completed' && (
            <button onClick={markActive} className="deck-btn">Mark active again</button>
          )}
          {set.isOwner && (
            <button onClick={deleteSet} className="deck-btn danger">Delete set</button>
          )}
        </div>
      </div>

      {set.isOwner && (
        <>
          <div className="tab-toggle">
            <button onClick={() => setShowBulk(false)} className={`tab-toggle-btn ${!showBulk ? 'active' : ''}`}>Single Add</button>
            <button onClick={() => setShowBulk(true)} className={`tab-toggle-btn ${showBulk ? 'active' : ''}`}>Bulk Add</button>
          </div>

          {!showBulk ? (
            <form onSubmit={addWord} className="form-row">
              <input type="text" placeholder="German" value={newFront} onChange={e => setNewFront(e.target.value)} />
              <input type="text" placeholder="English" value={newBack} onChange={e => setNewBack(e.target.value)} />
              <button type="submit" className="deck-btn primary">Add</button>
            </form>
          ) : (
            <div className="form-row">
              <p className="hint">One per line. Separators: tab, " - ", " | ", or comma. Format: German - English</p>
              <textarea rows={6} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="der Hund - the dog" />
              <button onClick={bulkAdd} className="deck-btn primary">Save all</button>
            </div>
          )}
        </>
      )}

      {words.length === 0 ? (
        <p className="empty-state">No words.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>German</th><th>English</th><th>Context</th>{set.isOwner && <th></th>}</tr>
          </thead>
          <tbody>
            {words.map(w => (
              <tr key={w.id}>
                <td>{w.front}</td>
                <td>{w.back}</td>
                <td className="col-deck">{w.context ?? ''}</td>
                {set.isOwner && <td><button onClick={() => deleteWord(w.id)} className="deck-btn danger">×</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
