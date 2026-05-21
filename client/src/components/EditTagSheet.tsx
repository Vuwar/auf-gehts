import { useEffect, useState } from 'react'
import { api, type Tag, type WordSet } from '../api'
import ConfirmationDialog from './ConfirmationDialog'

interface Props {
  tag: Tag
  weekId: string
  onClose: () => void
  onUpdated: () => void
  onDeleted: () => void
}

export default function EditTagSheet({ tag, weekId, onClose, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(tag.name)
  const [wordSetId, setWordSetId] = useState<string | null>(tag.wordSetId)
  const [readingTextId, setReadingTextId] = useState<string | null>(tag.readingTextId)
  const [readingTextTitle, setReadingTextTitle] = useState<string | null>(tag.readingTextTitle)
  const [questionCount, setQuestionCount] = useState(tag.questionCount)
  const [hasAudio, setHasAudio] = useState(tag.hasAudio)
  const [availableSets, setAvailableSets] = useState<WordSet[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    api.searchSets().then(sets => {
      setAvailableSets(sets.filter(s => !s.weekNumber || s.weekId === weekId))
    }).catch(() => {})
  }, [weekId])

  const hasChanges =
    name.trim() !== tag.name ||
    wordSetId !== tag.wordSetId ||
    readingTextId !== tag.readingTextId

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const patch: Record<string, unknown> = {}
      if (name.trim() !== tag.name) patch.name = name.trim()
      if (wordSetId !== tag.wordSetId) {
        if (wordSetId) patch.wordSetId = wordSetId
        else patch.clearWordSet = true
      }
      if (readingTextId !== tag.readingTextId) {
        if (readingTextId) patch.readingTextId = readingTextId
        else patch.clearReadingText = true
      }
      if (Object.keys(patch).length > 0) await api.updateTag(tag.id, patch)
      onUpdated()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const generatePassage = async () => {
    if (!wordSetId) { setError('Assign a word set first'); return }
    setGenerating(true)
    setError(null)
    try {
      const generated = await api.generateTagPassage(tag.id, wordSetId, 'A2', 4)
      const rt = await api.createReadingText({
        title: generated.title,
        content: generated.content,
        level: generated.level,
        weekId,
        generateAudio: true,
        questions: generated.questions.map(q => ({
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correctAnswer: q.correctAnswer,
        })),
      })
      await api.updateTag(tag.id, { readingTextId: rt.id })
      setReadingTextId(rt.id)
      setReadingTextTitle(generated.title)
      setQuestionCount(generated.questions.length)
      setHasAudio(true)
      onUpdated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const deleteTag = async () => {
    setDeleting(true)
    try {
      await api.deleteTag(tag.id)
      onDeleted()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setDeleting(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>Edit Tag {tag.tagNumber}</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>

        <div className="sheet-body">
          <div className="form-row">
            <span className="card-label">Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tag name"
            />

            <span className="card-label">Word set</span>
            <select
              value={wordSetId ?? ''}
              onChange={e => setWordSetId(e.target.value || null)}
            >
              <option value="">— none —</option>
              {availableSets.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.wordCount} words)</option>
              ))}
            </select>

            <span className="card-label">Passage</span>
            {readingTextId ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="hint">{readingTextTitle ?? 'Assigned'} · {questionCount} Qs {hasAudio ? '🎧' : ''}</span>
                <button
                  onClick={() => { setReadingTextId(null); setReadingTextTitle(null); setQuestionCount(0); setHasAudio(false) }}
                  className="deck-btn"
                >
                  Unassign
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={generatePassage}
                  disabled={!wordSetId || generating}
                  className="deck-btn primary"
                >
                  {generating ? 'Generating...' : '✨ Generate passage'}
                </button>
                {!wordSetId && <span className="hint">Assign a word set first</span>}
              </div>
            )}

            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}
          </div>

          <div className="edit-action-row">
            <button onClick={() => setConfirmingDelete(true)} className="deck-btn edit-delete-btn">
              Delete Tag
            </button>
            <button
              onClick={save}
              disabled={saving || !name.trim() || !hasChanges}
              className="deck-btn edit-save-btn"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>

          <ConfirmationDialog
            open={confirmingDelete}
            title="Delete Tag?"
            message={`Tag ${tag.tagNumber}: ${tag.name} will be permanently removed from this week.`}
            confirmLabel="Delete Tag"
            busy={deleting}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={deleteTag}
          />
        </div>
      </div>
    </div>
  )
}
