import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type ReadingText, type ReadingTextQuestion } from '../api'
import { useAuth } from '../auth'
import WordLookupPopup from './WordLookupPopup'

export default function ReaderDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'

  const [text, setText] = useState<ReadingText | null>(null)
  const [loading, setLoading] = useState(true)
  const [vocabFronts, setVocabFronts] = useState<Set<string>>(new Set())

  const [popup, setPopup] = useState<{ word: string; sentence: string | null; rect: DOMRect } | null>(null)

  const [translation, setTranslation] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.getReadingText(id).then(setText).finally(() => setLoading(false))
    api.vocabFronts().then(list => setVocabFronts(new Set(list.map(f => normalize(f))))).catch(() => {})
  }, [id])

  const onWordClick = (e: React.MouseEvent<HTMLSpanElement>, word: string, sentence: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPopup({ word, sentence, rect })
  }

  const translateAll = async () => {
    if (!text) return
    setTranslating(true)
    try {
      const r = await api.translate(text.content)
      setTranslation(r.translation)
    } catch (e: any) {
      alert(e.message)
    } finally { setTranslating(false) }
  }

  const onDelete = async () => {
    if (!text) return
    if (!confirm(`Delete "${text.title}"?`)) return
    await api.deleteReadingText(text.id)
    nav('/reader')
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

  if (loading) return <div className="deck"><p className="empty-state">Loading...</p></div>
  if (!text) return <div className="deck"><p className="empty-state">Text not found.</p></div>

  return (
    <div className="deck">
      <div>
        <button onClick={() => nav('/reader')} className="deck-btn">← All texts</button>
      </div>

      <div className="deck-header">
        <div>
          <h1>{text.title}</h1>
          <div className="hint" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {text.level && <span className="starter-level">{text.level}</span>}
            {text.weekNumber !== null && <span>· Woche {text.weekNumber}</span>}
            <span>· by {text.createdByName ?? 'Unknown'}</span>
          </div>
        </div>
        {(isAdmin || text.isOwner) && (
          <button onClick={onDelete} className="deck-btn danger">Delete</button>
        )}
      </div>

      <div className="reader-text">
        {renderText(text.content, vocabFronts, onWordClick)}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={translateAll} disabled={translating} className="deck-btn">
          {translating ? 'Translating...' : '🌐 Show translation'}
        </button>
      </div>

      {translation && (
        <div className="reader-translation">
          <span className="card-label">English translation</span>
          <p>{translation}</p>
          <button onClick={() => setTranslation(null)} className="deck-btn" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>Hide</button>
        </div>
      )}

      {text.questions.length > 0 && (
        <>
          <h2 className="section-title">Questions</h2>
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

function renderText(content: string, vocab: Set<string>, onClick: (e: React.MouseEvent<HTMLSpanElement>, word: string, sentence: string) => void) {
  const sentences = content.split(/(?<=[.!?])\s+/)
  return sentences.map((sentence, sIdx) => (
    <span key={sIdx}>
      {tokenize(sentence).map((tok, i) => {
        if (tok.isWord) {
          const isSaved = vocab.has(normalize(tok.text))
          return (
            <span
              key={i}
              className={`reader-word ${isSaved ? 'saved' : ''}`}
              onClick={(e) => onClick(e, tok.text, sentence.trim())}
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
  return s.toLowerCase().replace(/^(der|die|das)\s+/, '').trim()
}
