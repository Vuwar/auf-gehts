import { useEffect, useState } from 'react'
import { api, type ReadingText, type Week } from '../api'
import { useAuth } from '../auth'
import FilePicker from './FilePicker'
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
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={regenerateAudio} disabled={audioBusy} className="deck-btn">
                  {audioBusy ? 'Working…' : (audioState.audioUrl ? 'Regenerate TTS' : 'Generate TTS')}
                </button>
                {audioState.audioUrl && (
                  <button onClick={() => setConfirmingRemoveAudio(true)} disabled={audioBusy} className="deck-btn danger">
                    Remove audio
                  </button>
                )}
              </div>
              <FilePicker
                accept="audio/mpeg,audio/mp3,audio/wav"
                disabled={audioBusy}
                onChange={f => { if (f) uploadAudio(f) }}
                label="Upload audio file"
                hint=".mp3 or .wav. Replaces current audio."
              />
              {audioState.audioVoice && <p className="hint">Source: {audioState.audioVoice}</p>}
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
