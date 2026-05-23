import { useEffect, useState } from 'react'
import { api, type ReadingText, type ReadingTextQuestion, type ReadingQuestionType, type Week } from '../api'
import { useAuth } from '../auth'
import ConfirmationDialog from './ConfirmationDialog'
import { TrashIcon } from './EditSetSheet'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

type Tab = 'text' | 'questions'

type DraftQuestion = {
  type: ReadingQuestionType
  prompt: string
  options: string[]
  correctAnswer: string
}

const emptyQuestion = (): DraftQuestion => ({
  type: 'MultipleChoice',
  prompt: '',
  options: ['', '', '', ''],
  correctAnswer: '',
})

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

interface Props {
  text: ReadingText
  onClose: () => void
  onUpdated: (text: ReadingText) => void
  onDeleted: () => void
}

export default function EditTextSheet({ text, onClose, onUpdated, onDeleted }: Props) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'

  const [tab, setTab] = useState<Tab>('text')

  // Text tab state
  const [title, setTitle] = useState(text.title)
  const [content, setContent] = useState(text.content)
  const [level, setLevel] = useState(text.level ?? 'A2')
  const [isOfficial, setIsOfficial] = useState(text.weekId !== null)
  const [weekId, setWeekId] = useState(text.weekId ?? '')
  const [weeks, setWeeks] = useState<Week[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioBusy, setAudioBusy] = useState(false)
  const [audioState, setAudioState] = useState({
    audioUrl: text.audioUrl,
    audioVoice: text.audioVoice,
    audioDurationSec: text.audioDurationSec,
  })

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingRemoveAudio, setConfirmingRemoveAudio] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Questions tab state
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    (text.questions ?? []).map(questionFromApi)
  )
  const [aiConfigOpen, setAiConfigOpen] = useState(false)
  const [suggesting, setSuggesting] = useState(false)

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
    if (isAdmin) api.listWeeks().then(setWeeks).catch(() => {})
  }, [isAdmin])

  const save = async () => {
    if (!title.trim() || !content.trim()) { setError('Title and text are required'); return }
    setSaving(true); setError(null)
    try {
      const updated = await api.updateReadingText(text.id, {
        title: title.trim(),
        content,
        level,
        weekId: isAdmin && isOfficial && weekId ? weekId : null,
        clearWeek: !isAdmin ? false : (!isOfficial || !weekId),
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
      onUpdated({ ...updated, audioUrl: audioState.audioUrl, audioVoice: audioState.audioVoice, audioDurationSec: audioState.audioDurationSec })
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const refreshAudio = (updated: ReadingText) => {
    setAudioState({
      audioUrl: updated.audioUrl,
      audioVoice: updated.audioVoice,
      audioDurationSec: updated.audioDurationSec,
    })
    onUpdated(updated)
  }

  const regenerateAudio = async () => {
    setAudioBusy(true); setError(null)
    try {
      refreshAudio(await api.regeneratePassageAudio(text.id))
    } catch (e: any) {
      setError(e.message)
    } finally { setAudioBusy(false) }
  }

  const uploadAudio = async (file: File) => {
    setAudioBusy(true); setError(null)
    try {
      refreshAudio(await api.uploadPassageAudio(text.id, file))
    } catch (e: any) {
      setError(e.message)
    } finally { setAudioBusy(false) }
  }

  const removeAudio = async () => {
    setAudioBusy(true); setError(null)
    try {
      await api.deletePassageAudio(text.id)
      setAudioState({ audioUrl: null, audioVoice: null, audioDurationSec: null })
      onUpdated({ ...text, audioUrl: null, audioVoice: null, audioDurationSec: null })
      setConfirmingRemoveAudio(false)
    } catch (e: any) {
      setError(e.message)
    } finally { setAudioBusy(false) }
  }

  const deleteText = async () => {
    setDeleting(true)
    try {
      await api.deleteReadingText(text.id)
      onDeleted()
    } finally { setDeleting(false) }
  }

  // Question management
  const suggestQuestions = async (cfg: { level: string; count: number; types: ReadingQuestionType[] }) => {
    setAiConfigOpen(false)
    setSuggesting(true); setError(null)
    try {
      const r = await api.generateQuestions(content, cfg.level, cfg.count)
      const allowed = new Set<ReadingQuestionType>(cfg.types)
      const filtered = r.questions
        .map(q => questionFromApi(q))
        .filter(q => allowed.has(q.type))
      setQuestions(prev => [...prev, ...(filtered.length > 0 ? filtered : r.questions.map(q => questionFromApi(q)))])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSuggesting(false)
    }
  }

  const addQuestion = () => setQuestions(prev => [...prev, emptyQuestion()])
  const removeQuestion = (i: number) => setQuestions(prev => prev.filter((_, idx) => idx !== i))
  const updateQuestion = (i: number, patch: Partial<DraftQuestion>) => {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q))
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet sheet-wide" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>Edit text</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>

        <div className="sheet-tabs">
          <button
            className={`sheet-tab${tab === 'text' ? ' active' : ''}`}
            onClick={() => setTab('text')}
          >
            Text
          </button>
          <button
            className={`sheet-tab${tab === 'questions' ? ' active' : ''}`}
            onClick={() => setTab('questions')}
          >
            Questions{questions.filter(q => q.prompt.trim()).length > 0
              ? ` (${questions.filter(q => q.prompt.trim()).length})`
              : ''}
          </button>
        </div>

        <div className="sheet-body">
          {tab === 'text' && (
            <div className="form-row">
              <span className="card-label">Title</span>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} />

              <span className="card-label">Level</span>
              <select value={level} onChange={e => setLevel(e.target.value)}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>

              <span className="card-label">German text</span>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
              />

              {isAdmin && (
                <div className="form-row" style={{ borderColor: 'var(--accent-border)' }}>
                  <span className="card-label" style={{ color: 'var(--accent)' }}>Admin</span>

                  <button onClick={() => setIsOfficial(!isOfficial)} type="button" className="visibility-toggle">
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
                  <EditAudioChooser
                    audioState={audioState}
                    audioBusy={audioBusy}
                    onRegenerate={regenerateAudio}
                    onUpload={uploadAudio}
                    onRequestRemove={() => setConfirmingRemoveAudio(true)}
                  />
                </div>
              )}

              {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}

              <div className="edit-action-row">
                <button onClick={() => setConfirmingDelete(true)} className="deck-btn edit-delete-btn">
                  <TrashIcon /> Delete text
                </button>
                <button onClick={save} disabled={saving || !title.trim() || !content.trim()} className="deck-btn edit-save-btn">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {tab === 'questions' && (
            <div className="form-row">
              <p className="hint">Add or edit comprehension questions. Changes save with the text.</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setAiConfigOpen(true)}
                  disabled={suggesting || !content.trim()}
                  className="deck-btn"
                >
                  {suggesting ? 'Generating…' : 'AI suggest'}
                </button>
                <button onClick={addQuestion} className="deck-btn">+ Add manually</button>
              </div>

              {questions.length === 0 && (
                <p className="empty-state">No questions yet. Save without is fine.</p>
              )}

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

              <div className="edit-action-row">
                <button onClick={() => setConfirmingDelete(true)} className="deck-btn edit-delete-btn">
                  <TrashIcon /> Delete text
                </button>
                <button onClick={save} disabled={saving || !title.trim() || !content.trim()} className="deck-btn edit-save-btn">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          <ConfirmationDialog
            open={confirmingDelete}
            title="Delete text?"
            message={`"${text.title}" and its questions will be permanently deleted.`}
            confirmLabel="Delete text"
            busy={deleting}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={deleteText}
          />
          <ConfirmationDialog
            open={confirmingRemoveAudio}
            title="Remove audio?"
            message="The audio file will be removed. You can regenerate or upload a new one later."
            confirmLabel="Remove audio"
            busy={audioBusy}
            onCancel={() => setConfirmingRemoveAudio(false)}
            onConfirm={removeAudio}
          />
        </div>

        {aiConfigOpen && (
          <AiSuggestConfig
            defaultLevel={level}
            onCancel={() => setAiConfigOpen(false)}
            onConfirm={suggestQuestions}
          />
        )}
      </div>
    </div>
  )
}

// ─── Question Editor ──────────────────────────────────────────────────────────

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
            <option value="TrueFalse">True / false</option>
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

// ─── AI Suggest Config ────────────────────────────────────────────────────────

interface AiSuggestConfigProps {
  defaultLevel: string
  onCancel: () => void
  onConfirm: (cfg: { level: string; count: number; types: ReadingQuestionType[] }) => void
}

function AiSuggestConfig({ defaultLevel, onCancel, onConfirm }: AiSuggestConfigProps) {
  const [level, setLevel] = useState(defaultLevel)
  const [count, setCount] = useState(4)
  const [types, setTypes] = useState<Set<ReadingQuestionType>>(
    new Set(['MultipleChoice', 'TrueFalse', 'ShortAnswer'])
  )

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

// ─── Audio Chooser (edit mode) ────────────────────────────────────────────────

interface AudioChooserProps {
  audioState: { audioUrl: string | null; audioVoice: string | null; audioDurationSec: number | null }
  audioBusy: boolean
  onRegenerate: () => void
  onUpload: (file: File) => void
  onRequestRemove: () => void
}

function EditAudioChooser({ audioState, audioBusy, onRegenerate, onUpload, onRequestRemove }: AudioChooserProps) {
  const hasAudio = !!audioState.audioUrl
  const isUpload = hasAudio && audioState.audioVoice === 'upload'
  const isTTS = hasAudio && !isUpload

  if (isTTS) {
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
            <strong>TTS audio active</strong>
            <span className="hint">{audioState.audioVoice ? `Voice: ${audioState.audioVoice}` : 'German voice'}</span>
          </div>
        </div>
        <div className="audio-source-actions">
          <button type="button" onClick={onRegenerate} disabled={audioBusy} className="deck-btn">
            {audioBusy ? 'Working…' : 'Regenerate TTS'}
          </button>
          <button type="button" onClick={onRequestRemove} disabled={audioBusy} className="deck-btn danger">
            Remove audio
          </button>
        </div>
        <p className="hint">Custom upload is hidden while a TTS file exists. Remove first to upload your own.</p>
      </div>
    )
  }

  if (isUpload) {
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
            <strong>Custom audio active</strong>
            <span className="hint">Uploaded file</span>
          </div>
        </div>
        <div className="audio-source-actions">
          <button type="button" onClick={onRequestRemove} disabled={audioBusy} className="deck-btn danger">
            Remove audio
          </button>
        </div>
        <p className="hint">TTS generation is hidden while a custom file exists. Remove first to regenerate.</p>
      </div>
    )
  }

  return (
    <div className="audio-source-choices">
      <button type="button" className="audio-source-card" onClick={onRegenerate} disabled={audioBusy}>
        <span className="audio-source-card-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        </span>
        <span className="audio-source-card-title">{audioBusy ? 'Working…' : 'Generate with TTS'}</span>
        <span className="audio-source-card-sub">German voice, auto-aligned</span>
      </button>
      <label className={`audio-source-card audio-source-card-upload${audioBusy ? ' is-disabled' : ''}`}>
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
          disabled={audioBusy}
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}
