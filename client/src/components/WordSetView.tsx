import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type Word, type WordSet } from '../api'
import { useAuth } from '../auth'
import FlashCard from './FlashCard'
import EditSetSheet, { PenIcon } from './EditSetSheet'
import HoldToConfirm from './HoldToConfirm'
import ErrorView from './ErrorView'
import SpeakerIcon from './SpeakerIcon'
import { PageSkeleton } from './Skeletons'
import { speakGerman } from '../tts'

type View = 'list' | 'study'

export default function WordSetView() {
  const { setSlug } = useParams<{ setSlug: string }>()
  const setId = setSlug
  const combinedWeekNumber = (() => {
    if (!setSlug) return null
    const m = setSlug.match(/^weekly:(\d+)$/)
    return m ? Number(m[1]) : null
  })()
  const isCombined = combinedWeekNumber !== null
  const nav = useNavigate()
  const { profile } = useAuth()
  const canEdit = profile?.role !== 'ViewOnly'
  const isAdmin = profile?.role === 'Admin'
  const [set, setSet] = useState<WordSet | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [view, setView] = useState<View>('list')
  const [index, setIndex] = useState(0)
  const [studyQueue, setStudyQueue] = useState<Word[]>([])
  const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set())
  const [missedIds, setMissedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)

  useEffect(() => {
    if (!setId) return
    const load = isCombined
      ? Promise.all([
          api.getCombinedWeekSet(combinedWeekNumber!),
          api.listCombinedWeekWords(combinedWeekNumber!),
        ])
      : Promise.all([api.getSet(setId), api.listWords(setId)])
    load
      .then(([s, w]) => { setSet(s); setWords(w) })
      .catch(e => setError(e))
      .finally(() => setLoading(false))
  }, [setId, isCombined, combinedWeekNumber])

  const setProgressApi = async (status: 'NotStarted' | 'Active' | 'Completed') => {
    if (isCombined) {
      await api.setCombinedWeekProgress(combinedWeekNumber!, status)
    } else if (setId) {
      await api.setProgress(setId, status)
    }
  }

  const startStudy = async () => {
    if (!setId || !set) return
    setStudyQueue(words)
    setIndex(0)
    setLearnedIds(new Set())
    setMissedIds(new Set())
    setView('study')
    if (set.progressStatus === 'NotStarted') {
      await setProgressApi('Active')
      setSet({ ...set, progressStatus: 'Active' })
    }
  }

  const showToast = (message: string, undo?: () => void | Promise<void>) => {
    setToast({ message, undo: undo ? () => { undo() } : undefined })
    setTimeout(() => setToast(null), 5000)
  }

  const toggleBookmark = async () => {
    if (!setId || !set) return
    const next = !set.isFavorite
    await api.setFavorite(setId, next)
    setSet({ ...set, isFavorite: next })
    showToast(next ? 'Added to favorites' : 'Removed from favorites')
  }

  const gradeCard = async (knew: boolean) => {
    const current = studyQueue[index]
    if (!current) return
    const learned = new Set(learnedIds)
    const missed = new Set(missedIds)
    if (knew) { learned.add(current.id); missed.delete(current.id) }
    else { missed.add(current.id); learned.delete(current.id) }
    setLearnedIds(learned)
    setMissedIds(missed)
    const lastCard = index >= studyQueue.length - 1
    if (!lastCard) {
      setIndex(index + 1)
      return
    }
    // Auto-complete if user studied full set + missed none
    const studiedFullSet = studyQueue.length === words.length
    if (studiedFullSet && missed.size === 0 && learned.size === words.length && setId && set) {
      await setProgressApi('Completed')
      setSet({ ...set, progressStatus: 'Completed' })
    }
    setIndex(studyQueue.length) // summary
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

  const markActive = async () => {
    if (!setId || !set) return
    await setProgressApi('Active')
    setSet({ ...set, progressStatus: 'Active' })
    showToast('Reverted to active')
  }

  const clearProgress = async () => {
    if (!setId || !set) return
    await setProgressApi('NotStarted')
    setSet({ ...set, progressStatus: 'NotStarted' })
    showToast('Cleared progress')
  }


  if (loading) return <PageSkeleton page="detail" />
  if (error) return <div className="deck"><ErrorView error={error} context="set" /></div>
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
      <header className="set-header">
        <div className="set-header-top">
          <div className="set-header-title-block">
            <h1>{set.name}</h1>
            {set.description && <p className="set-subtitle">{set.description}</p>}
          </div>
          <div className="set-header-actions">
            {!isCombined && (
              <button
                onClick={toggleBookmark}
                className={`bookmark-btn ${set.isFavorite ? 'active' : ''}`}
                aria-label={set.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill={set.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            )}
            {!isCombined && (set.isOwner || isAdmin) && canEdit && (
              <button
                onClick={() => setEditOpen(true)}
                className="bookmark-btn"
                aria-label="Edit set"
              >
                <PenIcon />
              </button>
            )}
          </div>
        </div>

        <div className="meta-pills">
          {set.weekNumber && <span className="meta-pill">Woche {set.weekNumber}</span>}
          {set.level && <span className="meta-pill">{set.level}</span>}
          <span className="meta-pill">{set.isPublic ? 'Public' : 'Private'}</span>
          <span className="meta-pill">{words.length} {words.length === 1 ? 'word' : 'words'}</span>
          {set.progressStatus === 'Completed' && (
            <HoldToConfirm onConfirm={markActive} hint="Hold to revert">
              <span className="check-circle" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className="chip-label">Completed</span>
            </HoldToConfirm>
          )}
          {set.progressStatus === 'Active' && (
            <HoldToConfirm onConfirm={clearProgress} hint="Hold to clear">
              <span className="chip-label">◐ In progress</span>
            </HoldToConfirm>
          )}
        </div>
      </header>

      {words.length > 0 && (
        <button onClick={startStudy} className="study-action">
          <span className="study-action-icon">🎴</span>
          <span className="study-action-body">
            <span className="study-action-title">Flashcards</span>
            <span className="study-action-sub">
              {set.progressStatus === 'Completed'
                ? `Review again · ${words.length} word${words.length === 1 ? '' : 's'}`
                : set.progressStatus === 'Active'
                  ? `Continue · ${words.length} word${words.length === 1 ? '' : 's'}`
                  : `Start studying · ${words.length} word${words.length === 1 ? '' : 's'}`}
            </span>
          </span>
          <span className="study-action-arrow">→</span>
        </button>
      )}

      {words.length === 0 ? (
        <p className="empty-state">No words.</p>
      ) : (
        <ul className="word-list">
          {words.map(w => (
            <li key={w.id} className="word-card word-card-clickable" onClick={() => speakGerman(w.front)}>
              <div className="word-card-body">
                <div className="word-card-front">{w.front}</div>
                <div className="word-card-back">{w.back}</div>
                {w.context && <div className="word-card-context">{w.context}</div>}
              </div>
              <button className="word-speaker" onClick={(e) => { e.stopPropagation(); speakGerman(w.front) }} aria-label="Speak">
                <SpeakerIcon />
              </button>
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
