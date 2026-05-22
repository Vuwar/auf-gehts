import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type ReadingText, type ReadingTextQuestion } from '../api'
import { useAuth } from '../auth'
import WordLookupPopup from './WordLookupPopup'
import WordHighlightLegend from './WordHighlightLegend'
import AudioPlayer from './AudioPlayer'
import EditTextSheet from './EditTextSheet'
import { PenIcon } from './EditSetSheet'
import { LockIcon } from './Icons'
import { PageSkeleton } from './Skeletons'
import { buildWordTimings, wordAtTime } from '../wordSync'

type PassageMode = 'listen' | 'both' | 'read'
const PASSAGE_MODE_KEY = 'passageMode'

function loadInitialMode(): PassageMode {
  try {
    const v = localStorage.getItem(PASSAGE_MODE_KEY)
    if (v === 'listen' || v === 'both' || v === 'read') return v
  } catch {}
  return 'both'
}

export default function ReaderDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'

  const [text, setText] = useState<ReadingText | null>(null)
  const [loading, setLoading] = useState(true)
  const [vocabFronts, setVocabFronts] = useState<Set<string>>(new Set())

  const [popup, setPopup] = useState<{ word: string; sentence: string | null; rect: DOMRect } | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const touchScrolledRef = useRef(false)

  const [translation, setTranslation] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [translationOpen, setTranslationOpen] = useState(false)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)

  const [mode, setMode] = useState<PassageMode>(loadInitialMode)
  const [audioCompleted, setAudioCompleted] = useState(false)
  const [revealText, setRevealText] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [audioDuration, setAudioDuration] = useState(0)
  const wordTimingsRef = useRef<number[]>([])
  const textRef = useRef<HTMLDivElement>(null)
  const wordElsRef = useRef<HTMLElement[]>([])
  const lastSyncIdxRef = useRef(-1)
  const rafIdRef = useRef(0)
  const pendingIdxRef = useRef(-1)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setAudioCompleted(false)
    setRevealText(false)
    api.getReadingText(id).then(setText).finally(() => setLoading(false))
    api.vocabFronts().then(list => setVocabFronts(new Set(list.map(f => normalize(f))))).catch(() => {})
  }, [id])

  useEffect(() => {
    try { localStorage.setItem(PASSAGE_MODE_KEY, mode) } catch {}
  }, [mode])

  useEffect(() => {
    wordTimingsRef.current = text?.content && audioDuration > 0
      ? buildWordTimings(text.content, audioDuration) : []
    const els = wordElsRef.current
    if (lastSyncIdxRef.current >= 0 && els[lastSyncIdxRef.current]) {
      els[lastSyncIdxRef.current].removeAttribute('data-synced')
    }
    lastSyncIdxRef.current = -1
  }, [text?.content, audioDuration])

  useLayoutEffect(() => {
    const c = textRef.current
    if (!c) { wordElsRef.current = []; return }
    const nodes = c.querySelectorAll<HTMLElement>('[data-wi]')
    const arr: HTMLElement[] = new Array(nodes.length)
    nodes.forEach(n => {
      const i = Number(n.getAttribute('data-wi'))
      if (!Number.isNaN(i)) arr[i] = n
    })
    wordElsRef.current = arr
  }, [text?.content, vocabFronts])

  useEffect(() => () => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
  }, [])

  const handleTimeUpdate = useCallback((t: number) => {
    const times = wordTimingsRef.current
    if (times.length === 0) return
    const newIdx = wordAtTime(times, t)
    if (newIdx === pendingIdxRef.current) return
    pendingIdxRef.current = newIdx
    if (rafIdRef.current) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0
      const target = pendingIdxRef.current
      const last = lastSyncIdxRef.current
      if (target === last) return
      const els = wordElsRef.current
      if (last >= 0 && els[last]) els[last].removeAttribute('data-synced')
      if (target >= 0 && els[target]) els[target].setAttribute('data-synced', '')
      lastSyncIdxRef.current = target
    })
  }, [])

  // Fall back to "both" mode when the passage has no audio but mode is listen-only.
  const effectiveMode: PassageMode = (mode === 'listen' && !text?.audioUrl) ? 'both' : mode

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

  const toggleTranslation = async () => {
    if (!text) return
    if (translationOpen) { setTranslationOpen(false); return }
    if (translation) { setTranslationOpen(true); return }
    if (translating) return
    setTranslating(true)
    try {
      const r = await api.translate(text.content)
      setTranslation(r.translation)
      setTranslationOpen(true)
    } catch (e: any) {
      alert(e.message)
    } finally { setTranslating(false) }
  }

  const score = useMemo(() => {
    if (!text || !checked) return null
    let correct = 0; let total = 0
    for (const q of text.questions) {
      if (q.type === 'FreeText') continue
      total++
      const given = (answers[q.id] ?? '').trim().toLowerCase()
      const expected = (q.correctAnswer ?? '').trim().toLowerCase()
      if (given && expected && given === expected) correct++
    }
    return { correct, total }
  }, [text, checked, answers])

  if (loading) return <PageSkeleton page="detail" />
  if (!text) return <div className="deck"><p className="empty-state">Text not found.</p></div>
  if (!text.isUnlocked) return (
    <div className="deck">
      <div><button onClick={() => nav('/reader')} className="deck-btn offline-allow">← All texts</button></div>
      <div className="reader-locked">
        <span className="reader-locked-icon" aria-hidden><LockIcon size={32} /></span>
        <h2>{text.title}</h2>
        <p>Complete the day this text belongs to in order to unlock it.</p>
        {text.weekNumber && <p className="hint">Woche {text.weekNumber}</p>}
      </div>
    </div>
  )

  const showAudio = (effectiveMode === 'listen' || effectiveMode === 'both') && text.audioUrl
  const showText = effectiveMode === 'read' || effectiveMode === 'both' || (effectiveMode === 'listen' && revealText)
  const questionsGated = effectiveMode === 'listen' && !audioCompleted
  const canEdit = isAdmin || text.isOwner

  return (
    <div className="deck">
      <div>
        <button onClick={() => nav('/reader')} className="deck-btn offline-allow">← All texts</button>
      </div>

      <div className="deck-header">
        <div>
          <h1>{text.title}</h1>
          <div className="hint" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {text.level && <span className="starter-level">{text.level}</span>}
            {text.weekNumber !== null && <span>· Woche {text.weekNumber}</span>}
            {text.weekId === null && text.createdByUserId && text.createdByName && (
              <span>· by <Link to={`/profile/${text.createdByUserId}`} className="creator-link">{text.createdByName}</Link></span>
            )}
            {text.audioUrl && <span>· 🎧</span>}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setEditOpen(true)} className="edit-icon-btn" aria-label="Edit text">
            <PenIcon />
          </button>
        )}
      </div>

      <div className="passage-mode-row" role="tablist" aria-label="Passage mode">
        <button
          role="tab"
          aria-selected={effectiveMode === 'listen'}
          className={`passage-mode-pill ${effectiveMode === 'listen' ? 'active' : ''}`}
          onClick={() => setMode('listen')}
        >🎧 Listen</button>
        <button
          role="tab"
          aria-selected={effectiveMode === 'both'}
          className={`passage-mode-pill ${effectiveMode === 'both' ? 'active' : ''}`}
          onClick={() => setMode('both')}
        >🎧 📖 Both</button>
        <button
          role="tab"
          aria-selected={effectiveMode === 'read'}
          className={`passage-mode-pill ${effectiveMode === 'read' ? 'active' : ''}`}
          onClick={() => setMode('read')}
        >📖 Read</button>
      </div>

      {mode === 'listen' && !text.audioUrl && (
        <p className="hint">No audio for this passage yet. Showing text instead.</p>
      )}

      {showAudio && (
        <div className="passage-audio">
          <AudioPlayer
            src={text.audioUrl!}
            onEnded={() => setAudioCompleted(true)}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={setAudioDuration}
          />
        </div>
      )}

      {showText && (
        <div className="reader-text" ref={textRef}>
          {renderText(text.content, vocabFronts, onWordClick, onWordTouchStart, onWordTouchMove)}
          <WordHighlightLegend showDay={false} />
        </div>
      )}

      {effectiveMode === 'listen' && !revealText && audioCompleted && (
        <button onClick={() => setRevealText(true)} className="deck-btn">Reveal text</button>
      )}

      {showText && (
        <div className="translate-block">
          <div className="translate-footer">
            <div className="translate-legend" aria-label="Highlight legend">
              <span className="translate-legend-item">
                <span className="translate-legend-dot is-saved" aria-hidden />
                <span className="translate-legend-text-full">Saved vocab</span>
                <span className="translate-legend-text-short">Saved</span>
              </span>
              <span className="translate-legend-item">
                <span className="translate-legend-dot is-audio" aria-hidden />
                <span className="translate-legend-text-full">Now playing</span>
                <span className="translate-legend-text-short">Playing</span>
              </span>
            </div>
            <button
              type="button"
              onClick={toggleTranslation}
              disabled={translating}
              aria-expanded={translationOpen}
              className={`translate-toggle${translationOpen ? ' is-active' : ''}`}
            >
              {translationOpen ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              )}
              {translating ? (
                <span className="translate-toggle-text-full">Translating…</span>
              ) : (
                <>
                  <span className="translate-toggle-text-full">{translationOpen ? 'Hide translation' : 'Show translation'}</span>
                  <span className="translate-toggle-text-short">{translationOpen ? 'Hide' : 'Translate'}</span>
                </>
              )}
            </button>
          </div>
          <div className={`translate-panel${translationOpen && translation ? ' is-open' : ''}`} aria-hidden={!translationOpen}>
            <div className="translate-panel-inner">
              <span className="translate-panel-label">
                <span aria-hidden>🇬🇧</span>
                English translation
              </span>
              <p className="translate-panel-body">{translation}</p>
            </div>
          </div>
        </div>
      )}

      {text.questions.length > 0 && (
        <>
          <h2 className="section-title">Questions</h2>
          {questionsGated ? (
            <p className="hint">Listen to the audio first. Questions appear after one full playback.</p>
          ) : (
            <div className="form-row">
              {text.questions.map((q, idx) => (
                <QuestionView
                  key={q.id}
                  index={idx}
                  question={q}
                  answer={answers[q.id] ?? ''}
                  onAnswer={(val) => setAnswers({ ...answers, [q.id]: val })}
                  checked={checked}
                />
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {!checked ? (
                  <button onClick={() => setChecked(true)} className="deck-btn primary">Check answers</button>
                ) : (
                  <>
                    <button onClick={() => { setChecked(false); setAnswers({}) }} className="deck-btn">Reset</button>
                    {score && <p style={{ margin: 0, alignSelf: 'center' }}>Score: <strong>{score.correct} / {score.total}</strong></p>}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {popup && (
        <WordLookupPopup
          word={popup.word}
          sentence={popup.sentence}
          anchorRect={popup.rect}
          onClose={() => setPopup(null)}
          onSaved={(front) => setVocabFronts(new Set([...vocabFronts, normalize(front)]))}
        />
      )}
      {editOpen && (
        <EditTextSheet
          text={text}
          onClose={() => setEditOpen(false)}
          onUpdated={(t) => setText(t)}
          onDeleted={() => { setEditOpen(false); nav('/reader') }}
        />
      )}
    </div>
  )
}

interface QVProps {
  index: number
  question: ReadingTextQuestion
  answer: string
  onAnswer: (val: string) => void
  checked: boolean
}

function QuestionView({ index, question, answer, onAnswer, checked }: QVProps) {
  const expected = (question.correctAnswer ?? '').trim().toLowerCase()
  const given = answer.trim().toLowerCase()
  const isCorrect = checked && question.type !== 'FreeText' && given && expected && given === expected
  const isWrong = checked && question.type !== 'FreeText' && !!given && !isCorrect

  return (
    <div className={`question-view ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
        <strong>Q{index + 1}.</strong>
        <span>{question.prompt}</span>
      </div>

      {question.type === 'MultipleChoice' && question.options && (
        <div className="form-row" style={{ marginTop: '6px' }}>
          {question.options.map((opt, i) => (
            <label key={i} className="answer-option">
              <input type="radio" name={question.id} checked={answer === opt} onChange={() => onAnswer(opt)} disabled={checked} />
              <span>{opt}</span>
              {checked && opt === question.correctAnswer && <span style={{ color: 'var(--accent)' }}>✓</span>}
            </label>
          ))}
        </div>
      )}

      {question.type === 'TrueFalse' && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
          {['Richtig', 'Falsch'].map(opt => (
            <label key={opt} className="answer-option">
              <input type="radio" name={question.id} checked={answer === opt} onChange={() => onAnswer(opt)} disabled={checked} />
              <span>{opt}</span>
              {checked && opt === question.correctAnswer && <span style={{ color: 'var(--accent)' }}>✓</span>}
            </label>
          ))}
        </div>
      )}

      {question.type === 'ShortAnswer' && (
        <input
          type="text"
          value={answer}
          onChange={e => onAnswer(e.target.value)}
          disabled={checked}
          placeholder="Type answer..."
          style={{ marginTop: '6px' }}
        />
      )}

      {question.type === 'FreeText' && (
        <textarea
          value={answer}
          onChange={e => onAnswer(e.target.value)}
          rows={3}
          disabled={checked}
          placeholder="Type your answer..."
          style={{ marginTop: '6px' }}
        />
      )}

      {checked && question.type !== 'FreeText' && question.correctAnswer && (
        <p className="hint" style={{ marginTop: '4px' }}>Expected: <strong>{question.correctAnswer}</strong></p>
      )}
    </div>
  )
}

function renderText(
  content: string,
  vocab: Set<string>,
  onClick: (e: React.MouseEvent<HTMLSpanElement>, word: string, sentence: string) => void,
  onTouchStart: (e: React.TouchEvent<HTMLSpanElement>) => void,
  onTouchMove: (e: React.TouchEvent<HTMLSpanElement>) => void,
) {
  const sentences = content.split(/(?<=[.!?])\s+/)
  let wordIdx = 0
  return sentences.map((sentence, sIdx) => (
    <span key={sIdx}>
      {tokenize(sentence).map((tok, i) => {
        if (tok.isWord) {
          const myIdx = wordIdx++
          const isSaved = vocab.has(normalize(tok.text))
          return (
            <span
              key={i}
              className={`reader-word${isSaved ? ' is-saved' : ''}`}
              data-wi={myIdx}
              onClick={(e) => onClick(e, tok.text, sentence.trim())}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
            >
              {tok.text}
            </span>
          )
        }
        return <span key={i}>{tok.text}</span>
      })}
      {sIdx < sentences.length - 1 ? ' ' : ''}
    </span>
  ))
}

function tokenize(text: string): { text: string; isWord: boolean }[] {
  const tokens: { text: string; isWord: boolean }[] = []
  const regex = /([A-Za-zäöüÄÖÜß]+)|([^A-Za-zäöüÄÖÜß]+)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m[1]) tokens.push({ text: m[1], isWord: true })
    else tokens.push({ text: m[2], isWord: false })
  }
  return tokens
}

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[.,!?;:"'()¡¿«»„""‚'…]/g, '')
    .replace(/^(der|die|das)\s+/, '')
    .trim()
}
