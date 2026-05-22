import { useEffect, useState } from 'react'
import { api, type ReadingText, type Week } from '../api'
import { useAuth } from '../auth'
import ConfirmationDialog from './ConfirmationDialog'
import { TrashIcon } from './EditSetSheet'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

interface Props {
  text: ReadingText
  onClose: () => void
  onUpdated: (text: ReadingText) => void
  onDeleted: () => void
}

export default function EditTextSheet({ text, onClose, onUpdated, onDeleted }: Props) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'

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

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet sheet-wide" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>Edit text</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>
        <div className="sheet-body">
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
          </div>

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
      </div>
    </div>
  )
}

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
