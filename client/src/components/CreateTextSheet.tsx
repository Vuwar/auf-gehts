import { useEffect, useState } from 'react'
import { api, type ReadingText, type ReadingTextQuestion, type ReadingQuestionType, type Week } from '../api'
import { useAuth } from '../auth'
import FilePicker from './FilePicker'

interface Props {
  defaultWeekId?: string
  onClose: () => void
  onCreated: (text: ReadingText) => void
}

type Mode = 'paste' | 'generate'

type DraftQuestion = {
  type: ReadingQuestionType
  prompt: string
  options: string[]
  correctAnswer: string
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const emptyQuestion = (): DraftQuestion => ({
  type: 'MultipleChoice',
  prompt: '',
  options: ['', '', '', ''],
  correctAnswer: '',
})

export default function CreateTextSheet({ defaultWeekId, onClose, onCreated }: Props) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'
  const [mode, setMode] = useState<Mode>('paste')
  const [step, setStep] = useState<1 | 2>(1)

  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState('A2')
  const [weekId, setWeekId] = useState(defaultWeekId ?? '')
  const [isOfficial, setIsOfficial] = useState(!!defaultWeekId)
  const [weeks, setWeeks] = useState<Week[]>([])

  const [topic, setTopic] = useState('')
  const [wordCount, setWordCount] = useState(150)
  const [generating, setGenerating] = useState(false)

  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [generateAudio, setGenerateAudio] = useState(true)
  const [audioFile, setAudioFile] = useState<File | null>(null)

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
    api.listWeeks().then(setWeeks).catch(() => {})
  }, [])

  const generate = async () => {
    if (!topic.trim()) return
    setGenerating(true); setError(null)
    try {
      const r = await api.generateText(topic.trim(), level, wordCount)
      setContent(r.text)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const suggestQuestions = async () => {
    if (!content.trim()) return
    setSuggesting(true); setError(null)
    try {
      const r = await api.generateQuestions(content, level, 4)
      setQuestions(r.questions.map(q => questionFromApi(q)))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSuggesting(false)
    }
  }

  const addQuestion = () => setQuestions([...questions, emptyQuestion()])
  const removeQuestion = (i: number) => setQuestions(questions.filter((_, idx) => idx !== i))
  const updateQuestion = (i: number, patch: Partial<DraftQuestion>) => {
    setQuestions(questions.map((q, idx) => idx === i ? { ...q, ...patch } : q))
  }

  const submit = async () => {
    if (!title.trim() || !content.trim()) { setError('Title and text are required'); return }
    setSaving(true); setError(null)
    try {
      let t = await api.createReadingText({
        title: title.trim(),
        content,
        level,
        weekId: isAdmin && isOfficial && weekId ? weekId : null,
        generateAudio: audioFile ? false : generateAudio,
        questions: questions
          .filter(q => q.prompt.trim().length > 0)
          .map(q => ({
            type: q.type,
            prompt: q.prompt.trim(),
            options: (q.type === 'MultipleChoice' || q.type === 'TrueFalse')
              ? q.options.filter(o => o.trim().length > 0)
              : null,
            correctAnswer: q.correctAnswer.trim() || null,
          })),
      })
      if (audioFile) {
        t = await api.uploadPassageAudio(t.id, audioFile)
      }
      onCreated(t)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet sheet-wide" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>{step === 1 ? 'New reader text' : 'Add questions'}</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>
        <div className="sheet-body">
          {step === 1 && (
            <div className="form-row">
              <div className="tab-toggle">
                <button onClick={() => setMode('paste')} className={`tab-toggle-btn ${mode === 'paste' ? 'active' : ''}`}>Paste text</button>
                <button onClick={() => setMode('generate')} className={`tab-toggle-btn ${mode === 'generate' ? 'active' : ''}`}>Generate with AI</button>
              </div>

              {mode === 'paste' ? (
                <>
                  <span className="card-label">German text</span>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={8}
                    placeholder="Paste German text here..."
                  />
                </>
              ) : (
                <>
                  <p className="hint">AI generates text using Llama 3.3 via Groq.</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input type="text" placeholder="Topic" value={topic} onChange={e => setTopic(e.target.value)} style={{ flex: 2, minWidth: '160px' }} />
                    <input type="number" min={50} max={500} step={50} value={wordCount} onChange={e => setWordCount(Number(e.target.value))} style={{ width: '90px' }} />
                  </div>
                  <button onClick={generate} disabled={generating || !topic.trim()} className="deck-btn primary">
                    {generating ? 'Generating...' : 'Generate'}
                  </button>
                  {content && (
                    <textarea value={content} onChange={e => setContent(e.target.value)} rows={8} />
                  )}
                </>
              )}

              <span className="card-label">Title</span>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title shown in the library" />

              <span className="card-label">Level</span>
              <select value={level} onChange={e => setLevel(e.target.value)}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>

              {isAdmin && (
                <div className="form-row" style={{ borderColor: 'var(--accent-border)' }}>
                  <span className="card-label" style={{ color: 'var(--accent)' }}>Admin</span>

                  <button type="button" onClick={() => setIsOfficial(!isOfficial)} className="visibility-toggle">
                    <div className="visibility-toggle-text">
                      <span className="visibility-toggle-title">{isOfficial ? 'Official text' : 'Community text'}</span>
                      <span className="visibility-toggle-sub">{isOfficial ? 'Shows in Abenteuer week page' : 'Visible in Reader Community section'}</span>
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

                  <span className="card-label">Audio</span>
                  <button
                    type="button"
                    onClick={() => { if (!audioFile) setGenerateAudio(!generateAudio) }}
                    disabled={audioFile !== null}
                    className="visibility-toggle"
                  >
                    <div className="visibility-toggle-text">
                      <span className="visibility-toggle-title">Generate audio with TTS</span>
                      <span className="visibility-toggle-sub">German voice. Disabled if you upload your own audio file.</span>
                    </div>
                    <span className={`visibility-switch ${(generateAudio && !audioFile) ? 'on' : ''}`}>
                      <span className="visibility-switch-knob" />
                    </span>
                  </button>
                  <FilePicker
                    accept="audio/mpeg,audio/mp3,audio/wav"
                    file={audioFile}
                    onChange={setAudioFile}
                    label="Upload audio file"
                    hint=".mp3 or .wav, max 5MB. Overrides TTS."
                  />
                </div>
              )}

              {!isAdmin && (
                <>
                  <span className="card-label">Audio</span>
                  <button
                    type="button"
                    onClick={() => { if (!audioFile) setGenerateAudio(!generateAudio) }}
                    disabled={audioFile !== null}
                    className="visibility-toggle"
                  >
                    <div className="visibility-toggle-text">
                      <span className="visibility-toggle-title">Generate audio with TTS</span>
                      <span className="visibility-toggle-sub">German voice. Disabled if you upload your own audio file.</span>
                    </div>
                    <span className={`visibility-switch ${(generateAudio && !audioFile) ? 'on' : ''}`}>
                      <span className="visibility-switch-knob" />
                    </span>
                  </button>
                  <FilePicker
                    accept="audio/mpeg,audio/mp3,audio/wav"
                    file={audioFile}
                    onChange={setAudioFile}
                    label="Upload audio file"
                    hint=".mp3 or .wav, max 5MB. Overrides TTS."
                  />
                </>
              )}

              {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setStep(2)}
                  disabled={!content.trim() || !title.trim()}
                  className="deck-btn primary"
                >
                  Next: questions →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-row">
              <p className="hint">Add comprehension questions. Or let AI suggest some, then edit.</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={suggestQuestions} disabled={suggesting} className="deck-btn">
                  {suggesting ? 'Generating...' : '✨ AI suggest'}
                </button>
                <button onClick={addQuestion} className="deck-btn">+ Add manually</button>
              </div>

              {questions.length === 0 && <p className="empty-state">No questions yet. Publishing without is fine.</p>}

              {questions.map((q, i) => (
                <QuestionEditor
                  key={i}
                  index={i}
                  question={q}
                  onChange={(patch) => updateQuestion(i, patch)}
                  onRemove={() => removeQuestion(i)}
                />
              ))}

              {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '8px' }}>
                <button onClick={() => setStep(1)} className="deck-btn offline-allow">← Back</button>
                <button onClick={submit} disabled={saving} className="deck-btn primary">
                  {saving ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface QEProps {
  index: number
  question: DraftQuestion
  onChange: (patch: Partial<DraftQuestion>) => void
  onRemove: () => void
}

function QuestionEditor({ index, question, onChange, onRemove }: QEProps) {
  const setOption = (i: number, val: string) => {
    const opts = [...question.options]
    opts[i] = val
    onChange({ options: opts })
  }

  return (
    <div className="question-editor">
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong>Q{index + 1}</strong>
        <div style={{ display: 'flex', gap: '6px' }}>
          <select value={question.type} onChange={e => onChange({ type: e.target.value as ReadingQuestionType })}>
            <option value="MultipleChoice">Multiple choice</option>
            <option value="TrueFalse">True/False</option>
            <option value="ShortAnswer">Short answer</option>
            <option value="FreeText">Free text</option>
          </select>
          <button onClick={onRemove} className="deck-btn danger" aria-label="Remove question">×</button>
        </div>
      </div>
      <input
        type="text"
        placeholder="Question prompt (German)"
        value={question.prompt}
        onChange={e => onChange({ prompt: e.target.value })}
      />

      {question.type === 'MultipleChoice' && (
        <>
          {question.options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="radio"
                name={`q${index}-correct`}
                checked={question.correctAnswer === opt && opt !== ''}
                onChange={() => onChange({ correctAnswer: opt })}
              />
              <input
                type="text"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={e => setOption(i, e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          ))}
          <p className="hint">Pick the radio next to the correct option.</p>
        </>
      )}

      {question.type === 'TrueFalse' && (
        <div style={{ display: 'flex', gap: '12px' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="radio" name={`q${index}-tf`} checked={question.correctAnswer === 'Richtig'} onChange={() => onChange({ correctAnswer: 'Richtig', options: ['Richtig', 'Falsch'] })} />
            <span>Richtig</span>
          </label>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="radio" name={`q${index}-tf`} checked={question.correctAnswer === 'Falsch'} onChange={() => onChange({ correctAnswer: 'Falsch', options: ['Richtig', 'Falsch'] })} />
            <span>Falsch</span>
          </label>
        </div>
      )}

      {question.type === 'ShortAnswer' && (
        <input
          type="text"
          placeholder="Expected answer (case-insensitive)"
          value={question.correctAnswer}
          onChange={e => onChange({ correctAnswer: e.target.value })}
        />
      )}

      {question.type === 'FreeText' && (
        <p className="hint">Open-ended question. Not auto-graded.</p>
      )}
    </div>
  )
}

function questionFromApi(q: ReadingTextQuestion): DraftQuestion {
  const opts = q.options ?? []
  const padded = q.type === 'MultipleChoice'
    ? [...opts, '', '', '', ''].slice(0, 4)
    : opts.length > 0 ? opts : ['', '', '', '']
  return {
    type: q.type,
    prompt: q.prompt,
    options: padded,
    correctAnswer: q.correctAnswer ?? '',
  }
}
