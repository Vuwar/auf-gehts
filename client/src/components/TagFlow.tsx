import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type TagDetail, type Word, type ReadingTextQuestion } from '../api'
import { speakGerman, stopSpeaking, ttsAvailable } from '../tts'
import AudioPlayer from './AudioPlayer'
import { PageSkeleton } from './Skeletons'

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
  const [tag, setTag] = useState<TagDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('overview')
  const [stepIndex, setStepIndex] = useState(0)
  const [completedMask, setCompletedMask] = useState(0)

  useEffect(() => {
    if (!tagId) return
    setLoading(true)
    api.getTag(tagId).then(t => {
      setTag(t)
      setCompletedMask(t.completedStepsMask)
      setStepIndex(t.isCompleted ? 0 : Math.min(t.lastStep, TOTAL_STEPS - 1))
    }).finally(() => setLoading(false))
  }, [tagId])

  const completeStep = async (idx: number) => {
    if (!tag) return
    try {
      const r = await api.completeTagStep(tag.id, idx)
      setCompletedMask(r.completedStepsMask)
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
        <button onClick={() => nav(`/abenteuer/woche-${tag.weekNumber}`)} className="deck-btn">← Woche {tag.weekNumber}</button>
        <div className="deck-header"><h1>🔒 {tag.name}</h1></div>
        <p className="empty-state">Finish the previous Woche first.</p>
      </div>
    )
  }

  if (view === 'overview') {
    return (
      <Overview
        tag={tag}
        completedMask={completedMask}
        onBack={() => nav(`/abenteuer/woche-${tag.weekNumber}`)}
        onStart={startOrResume}
      />
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

function nextIncompleteStep(mask: number): number {
  for (let i = 0; i < TOTAL_STEPS; i++) {
    if ((mask & (1 << i)) === 0) return i
  }
  return 0
}

interface OverviewProps {
  tag: TagDetail
  completedMask: number
  onBack: () => void
  onStart: () => void
}

function Overview({ tag, completedMask, onBack, onStart }: OverviewProps) {
  const isStarted = completedMask !== 0
  const isComplete = completedMask === ALL_MASK
  const btnLabel = isComplete ? 'Wiederholen' : isStarted ? 'Weiter' : 'Los gehts'

  return (
    <div className="deck">
      <button onClick={onBack} className="deck-btn">← Woche {tag.weekNumber}</button>
      <div className="deck-header">
        <div>
          <h1>Tag {tag.tagNumber}: {tag.name}</h1>
          <span className="deck-progress">{tag.weekTitle}</span>
        </div>
      </div>
      <p className="hint">⏱ ~15 Minuten</p>

      <ol className="tag-steps-list" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {STEP_LABELS.map((lbl, i) => {
          const done = (completedMask & (1 << i)) !== 0
          return (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', border: '1px solid var(--border, #ddd)', borderRadius: '8px', background: done ? 'var(--accent-soft, #e8f5e9)' : 'transparent' }}>
              <span style={{ fontSize: '20px', minWidth: '24px' }}>{done ? '✓' : '○'}</span>
              <span style={{ fontWeight: 500 }}>{lbl}</span>
            </li>
          )
        })}
      </ol>

      <button onClick={onStart} className="deck-btn primary" style={{ marginTop: '16px', width: '100%' }}>
        {btnLabel}
      </button>
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
        <button onClick={onBack} className="deck-btn">← Overview</button>
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
  if (!text) {
    return (
      <div>
        <p className="empty-state">No reading text for this Tag.</p>
        <button onClick={onDone} className="deck-btn primary" style={{ width: '100%' }}>Continue →</button>
      </div>
    )
  }
  const wordSet = useMemo(() => new Set(words.map(w => normalizeWord(w.front))), [words])
  return (
    <div className="form-row">
      <p className="hint">Read along while audio plays. Today's words are highlighted.</p>
      {text.audioUrl && <AudioPlayer src={text.audioUrl} />}
      <div className="reader-text" style={{ padding: '16px', border: '1px solid var(--border, #ddd)', borderRadius: '8px', lineHeight: 1.7 }}>
        {renderHighlighted(text.content, wordSet)}
      </div>
      <button onClick={onDone} className="deck-btn primary" style={{ width: '100%' }}>Continue →</button>
    </div>
  )
}

function normalizeWord(s: string): string {
  return s.toLowerCase().replace(/^(der|die|das)\s+/, '').trim()
}

function renderHighlighted(content: string, wordSet: Set<string>) {
  const regex = /([A-Za-zäöüÄÖÜß]+)|([^A-Za-zäöüÄÖÜß]+)/g
  const out: React.ReactNode[] = []
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(content)) !== null) {
    if (m[1]) {
      const isMatch = wordSet.has(normalizeWord(m[1]))
      out.push(isMatch
        ? <mark key={i++} style={{ background: 'var(--accent-soft, #fff3a3)', padding: '0 2px', borderRadius: '3px' }}>{m[1]}</mark>
        : <span key={i++}>{m[1]}</span>)
    } else {
      out.push(<span key={i++}>{m[2]}</span>)
    }
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
