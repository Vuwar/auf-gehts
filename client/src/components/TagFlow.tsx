import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type Tag, type TagDetail, type Word, type ReadingTextQuestion } from '../api'
import { useAuth } from '../auth'
import { speakGerman, stopSpeaking, ttsAvailable } from '../tts'
import AudioPlayer from './AudioPlayer'
import WordLookupPopup from './WordLookupPopup'
import { buildWordTimings, wordAtTime } from '../wordSync'
import { PageSkeleton } from './Skeletons'
import EditTagSheet from './EditTagSheet'
import CreateSetForWeekSheet from './CreateSetForWeekSheet'
import AssignExistingSetSheet from './AssignExistingSetSheet'
import { PenIcon } from './EditSetSheet'
import StatusIcon from './StatusIcon'

const STEP_LABELS = [
  '1. Neue Wörter',
  '2. Flashcards',
  '3. Hören',
  '4. Lesen',
  '5. Fragen',
  '6. Nachsprechen',
]

const TOTAL_STEPS = 6
const ALL_MASK = (1 << TOTAL_STEPS) - 1

type View = 'overview' | 'step'

export default function TagFlow() {
  const { tagId } = useParams<{ tagId: string }>()
  const nav = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const isAdmin = profile?.role === 'Admin'
  const [tag, setTag] = useState<TagDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('overview')
  const [stepIndex, setStepIndex] = useState(0)
  const [completedMask, setCompletedMask] = useState(0)
  const [editingTag, setEditingTag] = useState(false)
  const [creatingSet, setCreatingSet] = useState(false)
  const [assigningExisting, setAssigningExisting] = useState(false)

  useEffect(() => {
    if (!tagId) return
    setLoading(true)
    api.getTag(tagId).then(t => {
      setTag(t)
      setCompletedMask(t.completedStepsMask)
      setStepIndex(t.isCompleted ? 0 : Math.min(t.lastStep, TOTAL_STEPS - 1))
    }).finally(() => setLoading(false))
  }, [tagId])

  const reload = () => {
    if (!tagId) return
    api.getTag(tagId).then(t => {
      setTag(t)
      setCompletedMask(t.completedStepsMask)
    })
  }

  const completeStep = async (idx: number) => {
    if (!tag) return
    try {
      const r = await api.completeTagStep(tag.id, idx)
      setCompletedMask(r.completedStepsMask)
      refreshProfile()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const advance = async () => {
    if (!tag) return
    const idx = stepIndex
    await completeStep(idx)
    if (idx + 1 >= TOTAL_STEPS) {
      setView('overview')
    } else {
      setStepIndex(idx + 1)
    }
  }

  const startOrResume = () => {
    if (!tag) return
    const resumeFrom = nextIncompleteStep(completedMask)
    setStepIndex(resumeFrom)
    setView('step')
  }

  if (loading) return <PageSkeleton page="detail" />
  if (!tag) return <div className="deck"><p className="empty-state">Tag not found.</p></div>

  if (tag.isLocked) {
    return (
      <div className="deck">
        <button onClick={() => nav(`/abenteuer/woche-${tag.weekNumber}`)} className="deck-btn offline-allow">← Woche {tag.weekNumber}</button>
        <div className="deck-header"><h1>🔒 {tag.name}</h1></div>
        <p className="empty-state">Complete the previous Tag to unlock this one.</p>
      </div>
    )
  }

  if (view === 'overview') {
    return (
      <>
        <Overview
          tag={tag}
          completedMask={completedMask}
          isAdmin={isAdmin}
          onBack={() => nav(`/abenteuer/woche-${tag.weekNumber}`)}
          onStart={startOrResume}
          onEdit={() => setEditingTag(true)}
          onCreateSet={() => setCreatingSet(true)}
          onAssignExisting={() => setAssigningExisting(true)}
        />
        {editingTag && (
          <EditTagSheet
            tag={tagDetailToTag(tag)}
            weekId={tag.weekId}
            onClose={() => setEditingTag(false)}
            onUpdated={() => { setEditingTag(false); reload() }}
            onDeleted={() => nav(`/abenteuer/woche-${tag.weekNumber}`)}
          />
        )}
        {creatingSet && (
          <CreateSetForWeekSheet
            weekId={tag.weekId}
            onClose={() => setCreatingSet(false)}
            onCreated={() => { setCreatingSet(false); reload() }}
          />
        )}
        {assigningExisting && (
          <AssignExistingSetSheet
            weekId={tag.weekId}
            onClose={() => setAssigningExisting(false)}
            onAssigned={() => { setAssigningExisting(false); reload() }}
          />
        )}
      </>
    )
  }

  return (
    <StepView
      tag={tag}
      stepIndex={stepIndex}
      onAdvance={advance}
      onBack={() => setView('overview')}
    />
  )
}

function tagDetailToTag(t: TagDetail): Tag {
  return {
    id: t.id,
    weekId: t.weekId,
    tagNumber: t.tagNumber,
    name: t.name,
    wordSetId: t.wordSet?.id ?? null,
    wordSetName: t.wordSet?.name ?? null,
    wordCount: t.wordSet?.wordCount ?? null,
    readingTextId: t.readingText?.id ?? null,
    readingTextTitle: t.readingText?.title ?? null,
    questionCount: t.readingText?.questions.length ?? 0,
    hasAudio: !!t.readingText?.audioUrl,
    completedStepsMask: t.completedStepsMask,
    lastStep: t.lastStep,
    isCompleted: t.isCompleted,
  }
}

function nextIncompleteStep(mask: number): number {
  for (let i = 0; i < TOTAL_STEPS; i++) {
    if ((mask & (1 << i)) === 0) return i
  }
  return 0
}

interface OverviewProps {
  tag: TagDetail
  completedMask: number
  isAdmin: boolean
  onBack: () => void
  onStart: () => void
  onEdit: () => void
  onCreateSet: () => void
  onAssignExisting: () => void
}

function Overview({ tag, completedMask, isAdmin, onBack, onStart, onEdit, onCreateSet, onAssignExisting }: OverviewProps) {
  const isStarted = completedMask !== 0
  const isComplete = completedMask === ALL_MASK
  const btnLabel = isComplete ? 'Wiederholen' : isStarted ? 'Weiter' : 'Los gehts'

  return (
    <div className="deck">
      <button onClick={onBack} className="deck-btn offline-allow">← Woche {tag.weekNumber}</button>
      <div className="deck-header">
        <div>
          <h1>Tag {tag.tagNumber}: {tag.name}</h1>
          <span className="deck-progress">{tag.weekTitle}</span>
        </div>
        {isAdmin && (
          <button onClick={onEdit} className="edit-icon-btn" aria-label="Edit tag">
            <PenIcon />
          </button>
        )}
      </div>
      <p className="hint">⏱ ~15 Minuten</p>

      <ol className="tag-steps-list" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {STEP_LABELS.map((lbl, i) => {
          const done = (completedMask & (1 << i)) !== 0
          return (
            <li key={i} className={`tag-step${done ? ' tag-step--done' : ''}`}>
              <StatusIcon status={done ? 'completed' : 'idle'} />
              <span className="tag-step-label">{lbl}</span>
            </li>
          )
        })}
      </ol>

      <button onClick={onStart} className="deck-btn primary" style={{ marginTop: '16px', width: '100%' }}>
        {btnLabel}
      </button>

      {isAdmin && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          <button onClick={onCreateSet} className="deck-btn primary">+ New Set</button>
          <button onClick={onAssignExisting} className="deck-btn">Assign Existing</button>
        </div>
      )}
    </div>
  )
}

interface StepProps {
  tag: TagDetail
  stepIndex: number
  onAdvance: () => void
  onBack: () => void
}

function StepView({ tag, stepIndex, onAdvance, onBack }: StepProps) {
  return (
    <div className="deck">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} className="deck-btn offline-allow">← Overview</button>
        <span className="hint">Step {stepIndex + 1} / {TOTAL_STEPS}</span>
      </div>
      <h2 className="section-title">{STEP_LABELS[stepIndex]}</h2>

      {stepIndex === 0 && <NeueWoerter words={tag.words} onDone={onAdvance} />}
      {stepIndex === 1 && <Flashcards words={tag.words} onDone={onAdvance} />}
      {stepIndex === 2 && <Hoeren audioUrl={tag.readingText?.audioUrl ?? null} onDone={onAdvance} />}
      {stepIndex === 3 && <Lesen text={tag.readingText} words={tag.words} onDone={onAdvance} />}
      {stepIndex === 4 && <Fragen questions={tag.readingText?.questions ?? []} onDone={onAdvance} />}
      {stepIndex === 5 && <Nachsprechen text={tag.readingText?.content ?? ''} onDone={onAdvance} />}
    </div>
  )
}

function NeueWoerter({ words, onDone }: { words: Word[]; onDone: () => void }) {
  const [i, setI] = useState(0)
  const canSpeak = ttsAvailable()
  useEffect(() => () => { stopSpeaking() }, [])

  if (words.length === 0) {
    return (
      <div>
        <p className="empty-state">No words for this Tag.</p>
        <button onClick={onDone} className="deck-btn primary" style={{ width: '100%' }}>Continue</button>
      </div>
    )
  }

  const w = words[i]
  const isLast = i === words.length - 1

  const speak = () => speakGerman(w.front)

  return (
    <div className="form-row">
      <div className="hint">Word {i + 1} / {words.length}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '24px', border: '1px solid var(--border, #ddd)', borderRadius: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '32px' }}>{w.front}</h2>
        {canSpeak && (
          <button onClick={speak} className="deck-btn" aria-label="Hear pronunciation">🔊 Hören</button>
        )}
        <p style={{ margin: 0, fontSize: '18px', color: 'var(--muted, #666)' }}>{w.back}</p>
        {w.context && <p className="hint" style={{ textAlign: 'center' }}>{w.context}</p>}
      </div>
      <button
        onClick={() => { stopSpeaking(); if (isLast) onDone(); else setI(i + 1) }}
        className="deck-btn primary"
        style={{ width: '100%' }}
      >
        {isLast ? 'Done →' : 'Next →'}
      </button>
    </div>
  )
}

function Flashcards({ words, onDone }: { words: Word[]; onDone: () => void }) {
  const [queue, setQueue] = useState<Word[]>([...words])
  const [wrongPile, setWrongPile] = useState<Word[]>([])
  const [flipped, setFlipped] = useState(false)
  const [correctSet, setCorrectSet] = useState<Set<string>>(new Set())

  useEffect(() => { setQueue([...words]); setWrongPile([]); setFlipped(false); setCorrectSet(new Set()) }, [words])

  if (words.length === 0) {
    return (
      <div>
        <p className="empty-state">No words to drill.</p>
        <button onClick={onDone} className="deck-btn primary" style={{ width: '100%' }}>Continue</button>
      </div>
    )
  }

  if (queue.length === 0 && wrongPile.length === 0) {
    return (
      <div className="form-row">
        <p className="empty-state">✓ All words recalled correctly!</p>
        <button onClick={onDone} className="deck-btn primary" style={{ width: '100%' }}>Continue →</button>
      </div>
    )
  }

  const current = queue[0] ?? wrongPile[0]
  const usingWrongPile = queue.length === 0

  const answer = (correct: boolean) => {
    const next = usingWrongPile ? [...wrongPile] : [...queue]
    const removed = next.shift()
    if (correct && removed) {
      const newCorrect = new Set(correctSet)
      newCorrect.add(removed.id)
      setCorrectSet(newCorrect)
    } else if (!correct && removed) {
      if (usingWrongPile) next.push(removed)
      else setWrongPile([...wrongPile, removed])
    }
    if (usingWrongPile) setWrongPile(next)
    else setQueue(next)

    if (next.length === 0 && !usingWrongPile && wrongPile.length === 0 && correct) {
      // done
    }
    setFlipped(false)
  }

  const total = words.length
  const remaining = queue.length + wrongPile.length

  return (
    <div className="form-row">
      <div className="hint">Remaining: {remaining} / {total} · ✓ {correctSet.size}</div>
      <div
        onClick={() => setFlipped(!flipped)}
        style={{ cursor: 'pointer', padding: '32px', border: '1px solid var(--border, #ddd)', borderRadius: '12px', textAlign: 'center', minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div>
          <span className="card-label">{flipped ? 'English' : 'German'}</span>
          <h2 style={{ margin: '8px 0 0', fontSize: '28px' }}>{flipped ? current.back : current.front}</h2>
          {!flipped && <p className="hint" style={{ marginTop: '8px' }}>Tap to reveal</p>}
        </div>
      </div>
      {flipped && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => answer(false)} className="deck-btn danger" style={{ flex: 1 }}>✗ Falsch</button>
          <button onClick={() => answer(true)} className="deck-btn primary" style={{ flex: 1 }}>✓ Richtig</button>
        </div>
      )}
    </div>
  )
}

function Hoeren({ audioUrl, onDone }: { audioUrl: string | null; onDone: () => void }) {
  const [plays, setPlays] = useState(0)
  const maxPlays = 3
  const [key, setKey] = useState(0)

  if (!audioUrl) {
    return (
      <div>
        <p className="empty-state">No audio available for this passage.</p>
        <button onClick={onDone} className="deck-btn primary" style={{ width: '100%' }}>Continue →</button>
      </div>
    )
  }

  return (
    <div className="form-row">
      <p className="hint">Listen carefully — text hidden. Plays: {plays} / {maxPlays}</p>
      <AudioPlayer
        key={key}
        src={audioUrl}
        onEnded={() => setPlays(p => p + 1)}
      />
      <div style={{ display: 'flex', gap: '8px' }}>
        {plays > 0 && plays < maxPlays && (
          <button onClick={() => setKey(k => k + 1)} className="deck-btn" style={{ flex: 1 }}>
            🔁 Replay ({maxPlays - plays} left)
          </button>
        )}
        <button onClick={onDone} disabled={plays === 0} className="deck-btn primary" style={{ flex: 1 }}>
          Continue →
        </button>
      </div>
    </div>
  )
}

function Lesen({ text, words, onDone }: { text: TagDetail['readingText']; words: Word[]; onDone: () => void }) {
  const [audioDuration, setAudioDuration] = useState(0)
  const wordTimingsRef = useRef<number[]>([])
  const textRef = useRef<HTMLDivElement>(null)
  const lastSyncIdxRef = useRef(-1)
  const wordSet = useMemo(() => new Set(words.map(w => normalizeWord(w.front))), [words])
  const [vocabFronts, setVocabFronts] = useState<Set<string>>(new Set())
  const [popup, setPopup] = useState<{ word: string; sentence: string | null; rect: DOMRect } | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const touchScrolledRef = useRef(false)

  useEffect(() => {
    api.vocabFronts()
      .then(list => setVocabFronts(new Set(list.map(f => normalizeWord(f)))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    wordTimingsRef.current = text?.content && audioDuration > 0
      ? buildWordTimings(text.content, audioDuration) : []
    if (lastSyncIdxRef.current >= 0) {
      textRef.current?.querySelector<HTMLElement>(`[data-wi="${lastSyncIdxRef.current}"]`)?.removeAttribute('data-synced')
    }
    lastSyncIdxRef.current = -1
  }, [text?.content, audioDuration])

  const handleTimeUpdate = useCallback((t: number) => {
    const newIdx = wordAtTime(wordTimingsRef.current, t)
    if (newIdx === lastSyncIdxRef.current) return
    const container = textRef.current
    if (container) {
      if (lastSyncIdxRef.current >= 0)
        container.querySelector<HTMLElement>(`[data-wi="${lastSyncIdxRef.current}"]`)?.removeAttribute('data-synced')
      if (newIdx >= 0)
        container.querySelector<HTMLElement>(`[data-wi="${newIdx}"]`)?.setAttribute('data-synced', '')
    }
    lastSyncIdxRef.current = newIdx
  }, [])

  const onWordClick = (e: React.MouseEvent<HTMLSpanElement>, word: string, sentence: string) => {
    if (touchScrolledRef.current) {
      touchScrolledRef.current = false
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPopup({ word, sentence, rect })
  }

  const onWordTouchStart = (e: React.TouchEvent<HTMLSpanElement>) => {
    const t = e.touches[0]
    if (!t) return
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    touchScrolledRef.current = false
  }

  const onWordTouchMove = (e: React.TouchEvent<HTMLSpanElement>) => {
    const start = touchStartRef.current
    if (!start) return
    const t = e.touches[0]
    if (!t) return
    const dx = Math.abs(t.clientX - start.x)
    const dy = Math.abs(t.clientY - start.y)
    if (dx > 8 || dy > 8) touchScrolledRef.current = true
  }

  if (!text) {
    return (
      <div>
        <p className="empty-state">No reading text for this Tag.</p>
        <button onClick={onDone} className="deck-btn primary" style={{ width: '100%' }}>Continue →</button>
      </div>
    )
  }
  return (
    <div className="form-row">
      <p className="hint">Read along while audio plays. Today's words are highlighted. Tap any word for a lookup.</p>
      {text.audioUrl && (
        <AudioPlayer
          src={text.audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={setAudioDuration}
        />
      )}
      <div ref={textRef} className="reader-text" style={{ padding: '16px', border: '1px solid var(--border, #ddd)', borderRadius: '8px', lineHeight: 1.7 }}>
        {renderHighlighted(text.content, wordSet, vocabFronts, onWordClick, onWordTouchStart, onWordTouchMove)}
      </div>
      <button onClick={onDone} className="deck-btn primary" style={{ width: '100%' }}>Continue →</button>
      {popup && (
        <WordLookupPopup
          word={popup.word}
          sentence={popup.sentence}
          anchorRect={popup.rect}
          onClose={() => setPopup(null)}
          onSaved={(front) => setVocabFronts(new Set([...vocabFronts, normalizeWord(front)]))}
        />
      )}
    </div>
  )
}

function normalizeWord(s: string): string {
  return s.toLowerCase().replace(/^(der|die|das)\s+/, '').trim()
}

function renderHighlighted(
  content: string,
  wordSet: Set<string>,
  vocab: Set<string>,
  onClick: (e: React.MouseEvent<HTMLSpanElement>, word: string, sentence: string) => void,
  onTouchStart: (e: React.TouchEvent<HTMLSpanElement>) => void,
  onTouchMove: (e: React.TouchEvent<HTMLSpanElement>) => void,
) {
  const sentences = content.split(/(?<=[.!?])\s+/)
  const out: React.ReactNode[] = []
  let key = 0
  let wordIdx = 0
  for (let s = 0; s < sentences.length; s++) {
    const sentence = sentences[s]
    const regex = /([A-Za-zäöüÄÖÜß]+)|([^A-Za-zäöüÄÖÜß]+)/g
    let m: RegExpExecArray | null
    while ((m = regex.exec(sentence)) !== null) {
      if (m[1]) {
        const myIdx = wordIdx++
        const token = m[1]
        const norm = normalizeWord(token)
        const isDayVocab = wordSet.has(norm)
        const isSaved = vocab.has(norm)
        const cls = `reader-word${isDayVocab ? ' day-vocab' : ''}${isSaved ? ' saved' : ''}`
        out.push(
          <span
            key={key++}
            className={cls}
            data-wi={myIdx}
            onClick={(e) => onClick(e, token, sentence.trim())}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
          >
            {token}
          </span>
        )
      } else {
        out.push(<span key={key++}>{m[2]}</span>)
      }
    }
    if (s < sentences.length - 1) out.push(<span key={key++}> </span>)
  }
  return out
}

function Fragen({ questions, onDone }: { questions: ReadingTextQuestion[]; onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)

  if (questions.length === 0) {
    return (
      <div>
        <p className="empty-state">No comprehension questions.</p>
        <button onClick={onDone} className="deck-btn primary" style={{ width: '100%' }}>Continue →</button>
      </div>
    )
  }

  const score = checked ? questions.reduce((acc, q) => {
    if (q.type === 'FreeText') return acc
    const given = (answers[q.id] ?? '').trim().toLowerCase()
    const expected = (q.correctAnswer ?? '').trim().toLowerCase()
    return acc + (given && expected && given === expected ? 1 : 0)
  }, 0) : 0
  const totalGraded = questions.filter(q => q.type !== 'FreeText').length

  return (
    <div className="form-row">
      {questions.map((q, idx) => {
        const given = (answers[q.id] ?? '').trim().toLowerCase()
        const expected = (q.correctAnswer ?? '').trim().toLowerCase()
        const isCorrect = checked && q.type !== 'FreeText' && given && expected && given === expected
        const isWrong = checked && q.type !== 'FreeText' && !!given && !isCorrect
        return (
          <div key={q.id} className={`question-view ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`} style={{ padding: '12px', border: '1px solid var(--border, #ddd)', borderRadius: '8px' }}>
            <div><strong>Q{idx + 1}.</strong> {q.prompt}</div>
            {q.type === 'MultipleChoice' && q.options && q.options.map((opt, i) => (
              <label key={i} className="answer-option" style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => setAnswers({ ...answers, [q.id]: opt })} disabled={checked} />
                <span>{opt}</span>
                {checked && opt === q.correctAnswer && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </label>
            ))}
            {q.type === 'TrueFalse' && ['Richtig', 'Falsch'].map(opt => (
              <label key={opt} className="answer-option" style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => setAnswers({ ...answers, [q.id]: opt })} disabled={checked} />
                <span>{opt}</span>
                {checked && opt === q.correctAnswer && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </label>
            ))}
            {q.type === 'ShortAnswer' && (
              <input type="text" value={answers[q.id] ?? ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} disabled={checked} style={{ marginTop: '6px' }} />
            )}
            {q.type === 'FreeText' && (
              <textarea value={answers[q.id] ?? ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} rows={3} disabled={checked} style={{ marginTop: '6px' }} />
            )}
            {checked && q.correctAnswer && q.type !== 'FreeText' && (
              <p className="hint" style={{ marginTop: '4px' }}>Expected: <strong>{q.correctAnswer}</strong></p>
            )}
          </div>
        )
      })}

      {!checked ? (
        <button onClick={() => setChecked(true)} className="deck-btn primary" style={{ width: '100%' }}>Check answers</button>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {totalGraded > 0 && <p style={{ margin: 0 }}>Score: <strong>{score} / {totalGraded}</strong></p>}
          <button onClick={onDone} className="deck-btn primary" style={{ flex: 1 }}>Continue →</button>
        </div>
      )}
    </div>
  )
}

function Nachsprechen({ text, onDone }: { text: string; onDone: () => void }) {
  const sentences = useMemo(() => {
    const all = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0)
    return all.slice(0, Math.min(3, Math.max(2, all.length)))
  }, [text])

  const [i, setI] = useState(0)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recogRef = useRef<any>(null)

  useEffect(() => () => { try { recogRef.current?.stop?.() } catch {}; stopSpeaking() }, [])
  useEffect(() => { setTranscript(null); setError(null) }, [i])

  if (sentences.length === 0) {
    return (
      <div>
        <p className="empty-state">No passage to repeat.</p>
        <button onClick={onDone} className="deck-btn primary" style={{ width: '100%' }}>Finish →</button>
      </div>
    )
  }

  const current = sentences[i]
  const isLast = i === sentences.length - 1

  const playSentence = () => speakGerman(current)

  const startRecord = () => {
    setError(null)
    setTranscript(null)
    const W = window as any
    const Rec = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!Rec) {
      setError('Web Speech API not supported in this browser. Try Chrome.')
      return
    }
    const r = new Rec()
    r.lang = 'de-DE'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e: any) => {
      const t = e.results[0]?.[0]?.transcript ?? ''
      setTranscript(t)
      setRecording(false)
    }
    r.onerror = (e: any) => { setError(`Error: ${e.error}`); setRecording(false) }
    r.onend = () => setRecording(false)
    recogRef.current = r
    setRecording(true)
    try { r.start() } catch (e: any) { setError(e.message); setRecording(false) }
  }

  const stopRecord = () => {
    try { recogRef.current?.stop?.() } catch {}
    setRecording(false)
  }

  const similarity = transcript ? calcSimilarity(transcript, current) : 0

  return (
    <div className="form-row">
      <div className="hint">Sentence {i + 1} / {sentences.length}</div>
      <div style={{ padding: '16px', border: '1px solid var(--border, #ddd)', borderRadius: '8px', fontSize: '18px', lineHeight: 1.6 }}>
        {current}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={playSentence} className="deck-btn">🔊 Replay</button>
        {!recording ? (
          <button onClick={startRecord} className="deck-btn primary">🎤 Record</button>
        ) : (
          <button onClick={stopRecord} className="deck-btn danger">⏹ Stop</button>
        )}
      </div>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {transcript !== null && (
        <div style={{ padding: '12px', border: '1px solid var(--border, #ddd)', borderRadius: '8px', background: similarity > 0.7 ? 'var(--accent-soft, #e8f5e9)' : '#fff3cd' }}>
          <span className="card-label">You said</span>
          <p style={{ margin: '4px 0' }}>{transcript}</p>
          <p className="hint">Match: {Math.round(similarity * 100)}%</p>
        </div>
      )}
      <button
        onClick={() => { stopSpeaking(); if (isLast) onDone(); else setI(i + 1) }}
        className="deck-btn primary"
        style={{ width: '100%' }}
      >
        {isLast ? 'Finish Tag →' : 'Next sentence →'}
      </button>
    </div>
  )
}

function calcSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[.,!?;:]/g, '').trim().split(/\s+/)
  const nb = b.toLowerCase().replace(/[.,!?;:]/g, '').trim().split(/\s+/)
  if (nb.length === 0) return 0
  const set = new Set(na)
  const hits = nb.filter(w => set.has(w)).length
  return hits / nb.length
}
