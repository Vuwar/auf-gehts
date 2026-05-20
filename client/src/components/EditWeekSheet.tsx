import { useEffect, useState } from 'react'
import { api, type WeekDetail, type Tag, type WordSet } from '../api'

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

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.updateWeek(week.id, { number, title: title.trim(), description: description.trim() || undefined })
      onUpdated()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteWeek = async () => {
    try {
      await api.deleteWeek(week.id)
      onDeleted()
    } catch (e: any) {
      setError(e.message)
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
    } catch (e: any) {
      setError(e.message)
    }
  }

  const removeTag = async (id: string) => {
    setTagBusy(id)
    try {
      await api.deleteTag(id)
      await reloadTags()
      onUpdated()
    } finally {
      setTagBusy(null)
    }
  }

  const updateTagField = async (tag: Tag, patch: { name?: string; wordSetId?: string | null; readingTextId?: string | null; clearWordSet?: boolean; clearReadingText?: boolean }) => {
    setTagBusy(tag.id)
    try {
      await api.updateTag(tag.id, patch)
      await reloadTags()
      onUpdated()
    } catch (e: any) {
      setError(e.message)
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
    } catch (e: any) {
      setError(e.message)
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

            <button onClick={save} disabled={saving || !title.trim()} className="deck-btn primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>

          <h3 className="section-title" style={{ marginTop: '16px' }}>Tags (daily sessions)</h3>
          <p className="hint">Each Tag gets a word set + a reading passage with comprehension questions.</p>

          {tags.length === 0 && <p className="empty-state">No tags yet. Add Tag 1 to start.</p>}

          {tags.sort((a, b) => a.tagNumber - b.tagNumber).map(tag => (
            <div key={tag.id} className="tag-editor" style={{ border: '1px solid var(--border, #ddd)', borderRadius: '8px', padding: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>Tag {tag.tagNumber}</strong>
                <button onClick={() => removeTag(tag.id)} disabled={tagBusy === tag.id} className="deck-btn danger" aria-label="Delete tag">×</button>
              </div>
              <input
                type="text"
                value={tag.name}
                onChange={e => setTags(tags.map(t => t.id === tag.id ? { ...t, name: e.target.value } : t))}
                onBlur={e => { if (e.target.value !== tag.name) updateTagField(tag, { name: e.target.value }) }}
                placeholder="Tag name"
              />

              <span className="card-label">Word set</span>
              <select
                value={tag.wordSetId ?? ''}
                onChange={e => {
                  const v = e.target.value
                  if (!v) updateTagField(tag, { clearWordSet: true })
                  else updateTagField(tag, { wordSetId: v })
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
                  <button onClick={() => updateTagField(tag, { clearReadingText: true })} className="deck-btn" disabled={tagBusy === tag.id}>Unassign</button>
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

          {!confirmingDelete ? (
            <button onClick={() => setConfirmingDelete(true)} className="deck-btn danger" style={{ marginTop: '16px', width: '100%' }}>
              Delete week
            </button>
          ) : (
            <div className="confirm-row">
              <div className="confirm-actions">
                <button onClick={() => setConfirmingDelete(false)} className="deck-btn cancel-btn">Cancel</button>
                <button onClick={deleteWeek} className="deck-btn danger-solid">Delete week</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
