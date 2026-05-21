import { useEffect, useState } from 'react'
import { api, type WeekDetail, type Tag, type WordSet } from '../api'
import ConfirmationDialog from './ConfirmationDialog'

interface Props {
  week: WeekDetail
  onClose: () => void
  onUpdated: () => void
  onDeleted: () => void
}

export default function EditWeekSheet({ week, onClose, onUpdated, onDeleted }: Props) {
  const [number, setNumber] = useState(week.number)
  const [title, setTitle] = useState(week.title)
  const [description, setDescription] = useState(week.description ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmTag, setConfirmTag] = useState<Tag | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [tags, setTags] = useState<Tag[]>(week.tags ?? [])
  const [availableSets, setAvailableSets] = useState<WordSet[]>([])
  const [tagBusy, setTagBusy] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)

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
      setAvailableSets(sets.filter(s => !s.weekNumber || s.weekId === week.id))
    }).catch(() => {})
  }, [week.id])

  const reloadTags = async () => {
    const t = await api.listTags(week.id)
    setTags(t)
  }

  const hasWeekChanges =
    number !== week.number ||
    title.trim() !== week.title ||
    description.trim() !== (week.description ?? '') ||
    tags.some(tag => {
      const original = (week.tags ?? []).find(t => t.id === tag.id)
      return !original ||
        tag.name !== original.name ||
        tag.wordSetId !== original.wordSetId ||
        tag.readingTextId !== original.readingTextId
    })

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.updateWeek(week.id, { number, title: title.trim(), description: description.trim() || undefined })
      for (const tag of tags) {
        const original = (week.tags ?? []).find(t => t.id === tag.id)
        if (!original) continue
        const patch: { name?: string; wordSetId?: string | null; readingTextId?: string | null; clearWordSet?: boolean; clearReadingText?: boolean } = {}
        if (tag.name !== original.name) patch.name = tag.name
        if (tag.wordSetId !== original.wordSetId) {
          if (tag.wordSetId) patch.wordSetId = tag.wordSetId
          else patch.clearWordSet = true
        }
        if (tag.readingTextId !== original.readingTextId) {
          if (tag.readingTextId) patch.readingTextId = tag.readingTextId
          else patch.clearReadingText = true
        }
        if (Object.keys(patch).length > 0) await api.updateTag(tag.id, patch)
      }
      onUpdated()
      onClose()
    } catch (e: unknown) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const deleteWeek = async () => {
    try {
      await api.deleteWeek(week.id)
      onDeleted()
    } catch (e: unknown) {
      setError(errorMessage(e))
    }
  }

  const addTag = async () => {
    const existing = new Set(tags.map(t => t.tagNumber))
    let n = 1
    while (existing.has(n) && n <= 7) n++
    if (n > 7) { setError('Max 7 tags per week'); return }
    try {
      await api.createTag(week.id, { tagNumber: n, name: `Tag ${n}` })
      await reloadTags()
      onUpdated()
    } catch (e: unknown) {
      setError(errorMessage(e))
    }
  }

  const removeTag = async () => {
    if (!confirmTag) return
    setTagBusy(confirmTag.id)
    try {
      await api.deleteTag(confirmTag.id)
      await reloadTags()
      onUpdated()
      setConfirmTag(null)
    } finally {
      setTagBusy(null)
    }
  }

  const generatePassage = async (tag: Tag) => {
    if (!tag.wordSetId) {
      setError('Assign a word set to this Tag first')
      return
    }
    setGenerating(tag.id)
    setError(null)
    try {
      const generated = await api.generateTagPassage(tag.id, tag.wordSetId, 'A2', 4)
      const rt = await api.createReadingText({
        title: generated.title,
        content: generated.content,
        level: generated.level,
        weekId: week.id,
        generateAudio: true,
        questions: generated.questions.map(q => ({
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correctAnswer: q.correctAnswer,
        })),
      })
      await api.updateTag(tag.id, { readingTextId: rt.id })
      await reloadTags()
      onUpdated()
    } catch (e: unknown) {
      setError(errorMessage(e))
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>Edit week</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>

        <div className="sheet-body">
          <div className="form-row">
            <span className="card-label">Number</span>
            <input type="number" value={number} onChange={e => setNumber(Number(e.target.value))} min={1} />

            <span className="card-label">Title</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} />

            <span className="card-label">Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />

            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>}

          </div>

          <h3 className="section-title" style={{ marginTop: '16px' }}>Tags (daily sessions)</h3>
          <p className="hint">Each Tag gets a word set + a reading passage with comprehension questions.</p>

          {tags.length === 0 && <p className="empty-state">No tags yet. Add Tag 1 to start.</p>}

          {tags.sort((a, b) => a.tagNumber - b.tagNumber).map(tag => (
            <div key={tag.id} className="tag-editor" style={{ border: '1px solid var(--border, #ddd)', borderRadius: '8px', padding: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>Tag {tag.tagNumber}</strong>
                <button onClick={() => setConfirmTag(tag)} disabled={tagBusy === tag.id} className="deck-btn danger" aria-label="Delete tag">×</button>
              </div>
              <input
                type="text"
                value={tag.name}
                onChange={e => setTags(tags.map(t => t.id === tag.id ? { ...t, name: e.target.value } : t))}
                placeholder="Tag name"
              />

              <span className="card-label">Word set</span>
              <select
                value={tag.wordSetId ?? ''}
                onChange={e => {
                  const v = e.target.value
                  setTags(tags.map(t => t.id === tag.id ? { ...t, wordSetId: v || null, wordSetName: availableSets.find(s => s.id === v)?.name ?? null } : t))
                }}
                disabled={tagBusy === tag.id}
              >
                <option value="">— none —</option>
                {availableSets.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.wordCount} words)</option>
                ))}
              </select>

              <span className="card-label">Passage</span>
              {tag.readingTextId ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="hint">{tag.readingTextTitle ?? 'Assigned'} · {tag.questionCount} Qs {tag.hasAudio ? '🎧' : ''}</span>
                  <button
                    onClick={() => setTags(tags.map(t => t.id === tag.id ? { ...t, readingTextId: null, readingTextTitle: null, questionCount: 0, hasAudio: false } : t))}
                    className="deck-btn"
                    disabled={tagBusy === tag.id}
                  >
                    Unassign
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => generatePassage(tag)}
                    disabled={!tag.wordSetId || generating === tag.id}
                    className="deck-btn primary"
                  >
                    {generating === tag.id ? 'Generating...' : '✨ Generate passage'}
                  </button>
                  {!tag.wordSetId && <span className="hint">Assign a word set first</span>}
                </div>
              )}
            </div>
          ))}

          {tags.length < 7 && (
            <button onClick={addTag} className="deck-btn" style={{ marginTop: '8px', width: '100%' }}>
              + Add Tag {tags.length + 1}
            </button>
          )}

          <div className="edit-action-row">
            <button onClick={() => setConfirmingDelete(true)} className="deck-btn edit-delete-btn">Delete week</button>
            <button onClick={save} disabled={saving || !title.trim() || !hasWeekChanges} className="deck-btn edit-save-btn">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <ConfirmationDialog
            open={confirmingDelete}
            title="Delete week?"
            message={`Woche ${week.number}: ${week.title} will be permanently deleted.`}
            confirmLabel="Delete week"
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={deleteWeek}
          />
          <ConfirmationDialog
            open={!!confirmTag}
            title="Delete Tag?"
            message={`Tag ${confirmTag?.tagNumber ?? ''} will be permanently removed from this week.`}
            confirmLabel="Delete Tag"
            busy={tagBusy === confirmTag?.id}
            onCancel={() => setConfirmTag(null)}
            onConfirm={removeTag}
          />
        </div>
      </div>
    </div>
  )
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong'
}
