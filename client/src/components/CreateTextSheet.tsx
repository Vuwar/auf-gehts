import { useEffect, useState } from 'react'
import { api, type ReadingText, type ReadingTextQuestion, type ReadingQuestionType, type Week } from '../api'
import { useAuth } from '../auth'

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
  const [aiConfigOpen, setAiConfigOpen] = useState(false)
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

  const suggestQuestions = async (cfg: { level: string; count: number; types: ReadingQuestionType[] }) => {
    if (!content.trim()) return
    setAiConfigOpen(false)
    setSuggesting(true); setError(null)
    try {
      const r = await api.generateQuestions(content, cfg.level, cfg.count)
      const allowed = new Set<ReadingQuestionType>(cfg.types)
      const filtered = r.questions
        .map(q => questionFromApi(q))
        .filter(q => allowed.has(q.type))
      setQuestions(filtered.length > 0 ? filtered : r.questions.map(q => questionFromApi(q)))
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
                  <AudioSourceChooser
                    generateAudio={generateAudio}
                    setGenerateAudio={setGenerateAudio}
                    audioFile={audioFile}
                    setAudioFile={setAudioFile}
                  />
                </div>
              )}

              {!isAdmin && (
                <>
                  <span className="card-label">Audio</span>
                  <AudioSourceChooser
                    generateAudio={generateAudio}
                    setGenerateAudio={setGenerateAudio}
                    audioFile={audioFile}
                    setAudioFile={setAudioFile}
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
                <button onClick={() => setAiConfigOpen(true)} disabled={suggesting} className="deck-btn">
                  {suggesting ? 'Generating...' : 'AI suggest'}
                </button>
                <button onClick={addQuestion} className="deck-btn">+ Add manually</button>
              </div>
              {aiConfigOpen && (
                <AiSuggestConfig
                  defaultLevel={level}
                  onCancel={() => setAiConfigOpen(false)}
                  onConfirm={suggestQuestions}
                />
              )}

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

interface AiSuggestConfigProps {
  defaultLevel: string
  onCancel: () => void
  onConfirm: (cfg: { level: string; count: number; types: ReadingQuestionType[] }) => void
}

function AiSuggestConfig({ defaultLevel, onCancel, onConfirm }: AiSuggestConfigProps) {
  const [level, setLevel] = useState(defaultLevel)
  const [count, setCount] = useState(4)
  const [types, setTypes] = useState<Set<ReadingQuestionType>>(new Set(['MultipleChoice', 'TrueFalse', 'ShortAnswer']))

  const toggleType = (t: ReadingQuestionType) => {
    const next = new Set(types)
    if (next.has(t)) next.delete(t); else next.add(t)
    setTypes(next)
  }

  const canSubmit = types.size > 0 && count > 0

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet ai-config-sheet" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>AI suggest options</h2>
          <button onClick={onCancel} className="sheet-close" aria-label="Close">×</button>
        </header>
        <div className="sheet-body">
          <div className="form-row">
            <span className="card-label">Difficulty</span>
            <div className="ai-config-chips">
              {LEVELS.map(l => (
                <button
                  key={l}
                  type="button"
                  className={`ai-config-chip${level === l ? ' is-active' : ''}`}
                  onClick={() => setLevel(l)}
                >{l}</button>
              ))}
            </div>

            <span className="card-label">Question types</span>
            <div className="ai-config-types">
              {([
                ['MultipleChoice', 'Multiple choice'],
                ['TrueFalse', 'True / false'],
                ['ShortAnswer', 'Short answer'],
              ] as [ReadingQuestionType, string][]).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  className={`ai-config-type${types.has(t) ? ' is-active' : ''}`}
                  onClick={() => toggleType(t)}
                >
                  <span className="ai-config-type-check" aria-hidden>
                    {types.has(t) && (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <span className="card-label">Number of questions</span>
            <div className="ai-config-chips">
              {[3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`ai-config-chip${count === n ? ' is-active' : ''}`}
                  onClick={() => setCount(n)}
                >{n}</button>
              ))}
            </div>

            <div className="edit-action-row">
              <button onClick={onCancel} className="deck-btn">Cancel</button>
              <button
                onClick={() => onConfirm({ level, count, types: Array.from(types) })}
                disabled={!canSubmit}
                className="deck-btn primary"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface AudioSourceChooserProps {
  generateAudio: boolean
  setGenerateAudio: (v: boolean) => void
  audioFile: File | null
  setAudioFile: (f: File | null) => void
}

function AudioSourceChooser({ generateAudio, setGenerateAudio, audioFile, setAudioFile }: AudioSourceChooserProps) {
  if (audioFile) {
    return (
      <div className="audio-source-active">
        <div className="audio-source-active-row">
          <div className="audio-source-active-icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
            </svg>
          </div>
          <div className="audio-source-active-body">
            <strong>Custom audio file</strong>
            <span className="hint">{audioFile.name}</span>
          </div>
          <button type="button" className="deck-btn danger" onClick={() => setAudioFile(null)}>Remove</button>
        </div>
        <p className="hint">TTS generation is disabled while a custom file is queued.</p>
      </div>
    )
  }

  if (generateAudio) {
    return (
      <div className="audio-source-active">
        <div className="audio-source-active-row">
          <div className="audio-source-active-icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          </div>
          <div className="audio-source-active-body">
            <strong>TTS will generate</strong>
            <span className="hint">German voice generated on publish</span>
          </div>
          <button type="button" className="deck-btn" onClick={() => setGenerateAudio(false)}>Switch off</button>
        </div>
        <p className="hint">Custom upload is hidden while TTS is enabled.</p>
      </div>
    )
  }

  return (
    <div className="audio-source-choices">
      <button type="button" className="audio-source-card" onClick={() => setGenerateAudio(true)}>
        <span className="audio-source-card-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        </span>
        <span className="audio-source-card-title">Generate with TTS</span>
        <span className="audio-source-card-sub">German voice, auto-aligned</span>
      </button>
      <label className="audio-source-card audio-source-card-upload">
        <span className="audio-source-card-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </span>
        <span className="audio-source-card-title">Upload .mp3 / .wav</span>
        <span className="audio-source-card-sub">Max 5 MB</span>
        <input
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0] ?? null
            if (f) setAudioFile(f)
            e.target.value = ''
          }}
        />
      </label>
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
