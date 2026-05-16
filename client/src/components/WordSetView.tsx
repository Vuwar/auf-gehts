import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type Word, type WordSet } from '../api'
import { useAuth } from '../auth'
import FlashCard from './FlashCard'
import EditSetSheet, { PenIcon } from './EditSetSheet'

type View = 'list' | 'study'

export default function WordSetView() {
  const { setSlug } = useParams<{ setSlug: string }>()
  const setId = setSlug
  const nav = useNavigate()
  const { profile } = useAuth()
  const canEdit = profile?.role !== 'ViewOnly'
  const [set, setSet] = useState<WordSet | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [view, setView] = useState<View>('list')
  const [index, setIndex] = useState(0)
  const [studyQueue, setStudyQueue] = useState<Word[]>([])
  const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set())
  const [missedIds, setMissedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)

  useEffect(() => {
    if (!setId) return
    Promise.all([api.getSet(setId), api.listWords(setId)])
      .then(([s, w]) => { setSet(s); setWords(w) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [setId])

  const startStudy = async () => {
    if (!setId || !set) return
    setStudyQueue(words)
    setIndex(0)
    setLearnedIds(new Set())
    setMissedIds(new Set())
    setView('study')
    if (set.progressStatus === 'NotStarted') {
      await api.setProgress(setId, 'Active')
      setSet({ ...set, progressStatus: 'Active' })
      showToast('Added to library', async () => {
        if (!setId) return
        await api.setProgress(setId, 'NotStarted')
        setSet(s => s ? { ...s, progressStatus: 'NotStarted' } : s)
      })
    }
  }

  const showToast = (message: string, undo?: () => void | Promise<void>) => {
    setToast({ message, undo: undo ? () => { undo() } : undefined })
    setTimeout(() => setToast(null), 5000)
  }

  const toggleBookmark = async () => {
    if (!setId || !set) return
    if (set.progressStatus === 'NotStarted') {
      await api.setProgress(setId, 'Active')
      setSet({ ...set, progressStatus: 'Active' })
      showToast('Added to library')
    } else {
      await api.setProgress(setId, 'NotStarted')
      setSet({ ...set, progressStatus: 'NotStarted' })
      showToast('Removed from library')
    }
  }

  const gradeCard = (knew: boolean) => {
    const current = studyQueue[index]
    if (!current) return
    const learned = new Set(learnedIds)
    const missed = new Set(missedIds)
    if (knew) { learned.add(current.id); missed.delete(current.id) }
    else { missed.add(current.id); learned.delete(current.id) }
    setLearnedIds(learned)
    setMissedIds(missed)
    if (index < studyQueue.length - 1) setIndex(index + 1)
    else setIndex(studyQueue.length) // out-of-range = summary
  }

  const reviewMissed = () => {
    const missedWords = studyQueue.filter(w => missedIds.has(w.id))
    if (missedWords.length === 0) return
    setStudyQueue(missedWords)
    setIndex(0)
    setLearnedIds(new Set())
    setMissedIds(new Set())
  }

  const restartAll = () => {
    setStudyQueue(words)
    setIndex(0)
    setLearnedIds(new Set())
    setMissedIds(new Set())
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


  if (loading) return <div className="deck"><p className="empty-state">Loading...</p></div>
  if (error) return <div className="deck"><p className="empty-state" style={{ color: 'var(--danger)' }}>{error}</p></div>
  if (!set) return null

  if (view === 'study') {
    const done = index >= studyQueue.length
    const card = studyQueue[index]
    const learnedCount = learnedIds.size
    const missedCount = missedIds.size

    return (
      <div className="deck">
        <div>
          <button onClick={() => setView('list')} className="deck-btn">← Back to set</button>
        </div>
        <div className="deck-header">
          <h1>{set.name}</h1>
          {!done && <span className="deck-progress">{index + 1} / {studyQueue.length}</span>}
        </div>

        {done ? (
          <div className="study-summary">
            <div className="study-summary-stats">
              <div className="summary-stat">
                <span className="summary-stat-num" style={{ color: 'var(--accent)' }}>{learnedCount}</span>
                <span className="summary-stat-label">Memorized</span>
              </div>
              <div className="summary-stat">
                <span className="summary-stat-num" style={{ color: 'var(--danger)' }}>{missedCount}</span>
                <span className="summary-stat-label">To practice</span>
              </div>
            </div>
            <h2 style={{ textAlign: 'center', margin: '8px 0' }}>
              {missedCount === 0 ? 'Perfekt! 🎉' : 'Gute Arbeit!'}
            </h2>
            <div className="study-summary-actions">
              {missedCount > 0 && (
                <button onClick={reviewMissed} className="deck-btn primary">Practice {missedCount} missed</button>
              )}
              <button onClick={restartAll} className="deck-btn">Study all again</button>
              {set.progressStatus !== 'Completed' && (
                <button onClick={async () => { await markComplete(); setView('list') }} className="deck-btn">Mark set complete ✓</button>
              )}
              <button onClick={() => setView('list')} className="deck-btn">Done</button>
            </div>
          </div>
        ) : (
          <div className="card-section">
            <FlashCard key={card.id} front={card.front} back={card.back} />
            {card.context && (
              <div className="reader-context" style={{ maxWidth: '480px', width: '100%' }}>
                <span className="card-label">Context</span>
                <p>{card.context}</p>
              </div>
            )}
            <div className="grade-buttons">
              <button onClick={() => gradeCard(false)} className="grade-btn grade-miss" aria-label="I forgot">
                <span className="grade-icon">✗</span>
              </button>
              <button onClick={() => gradeCard(true)} className="grade-btn grade-learn" aria-label="I knew it">
                <span className="grade-icon">✓</span>
              </button>
            </div>
            <div className="study-progress-bar">
              <div className="study-progress-fill" style={{ width: `${(index / studyQueue.length) * 100}%` }} />
            </div>
            <div className="study-counters">
              <span className={`counter-chip counter-miss ${missedCount > 0 ? 'active' : ''}`}>
                <span className="counter-dot" /> {missedCount}
              </span>
              <span className={`counter-chip counter-learn ${learnedCount > 0 ? 'active' : ''}`}>
                <span className="counter-dot" /> {learnedCount}
              </span>
            </div>
          </div>
        )}

        {toast && (
          <div className="toast" role="status">
            <span>{toast.message}</span>
            {toast.undo && (
              <button onClick={() => { toast.undo!(); setToast(null) }} className="toast-undo">Undo</button>
            )}
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
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <h1 style={{ flex: 1, margin: 0 }}>{set.name}</h1>
            <button
              onClick={toggleBookmark}
              className={`bookmark-btn ${set.progressStatus !== 'NotStarted' ? 'active' : ''}`}
              aria-label={set.progressStatus !== 'NotStarted' ? 'Remove from library' : 'Add to library'}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill={set.progressStatus !== 'NotStarted' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
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
          {set.progressStatus === 'Completed' && (
            <button onClick={markActive} className="deck-btn">Mark active again</button>
          )}
          {set.isOwner && canEdit && (
            <button onClick={() => setEditOpen(true)} className="deck-btn" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <PenIcon /> Edit
            </button>
          )}
        </div>
      </div>

      {words.length > 0 && (
        <button onClick={startStudy} className="study-action">
          <span className="study-action-icon">🎴</span>
          <span className="study-action-body">
            <span className="study-action-title">Flashcards</span>
            <span className="study-action-sub">Flip cards to test yourself · {words.length} word{words.length === 1 ? '' : 's'}</span>
          </span>
          <span className="study-action-arrow">→</span>
        </button>
      )}

      {words.length === 0 ? (
        <p className="empty-state">No words.</p>
      ) : (
        <ul className="word-list">
          {words.map(w => (
            <li key={w.id} className="word-card">
              <div className="word-card-body">
                <div className="word-card-front">{w.front}</div>
                <div className="word-card-back">{w.back}</div>
                {w.context && <div className="word-card-context">{w.context}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editOpen && set && (
        <EditSetSheet
          set={set}
          words={words}
          onClose={() => setEditOpen(false)}
          onSetUpdated={(s) => setSet(s)}
          onWordsChanged={(w) => setWords(w)}
          onDeleted={() => { setEditOpen(false); nav('/library') }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.undo && (
            <button onClick={() => { toast.undo!(); setToast(null) }} className="toast-undo">Undo</button>
          )}
        </div>
      )}
    </div>
  )
}
