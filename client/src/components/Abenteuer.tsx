import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type Week, type WeekDetail, type Tag } from '../api'
import { useAuth } from '../auth'
import EditWeekSheet from './EditWeekSheet'
import EditTagSheet from './EditTagSheet'
import CreateWeekSheet from './CreateWeekSheet'
import { PageSkeleton } from './Skeletons'
import { PenIcon } from './EditSetSheet'
import StatusIcon from './StatusIcon'

export default function Abenteuer() {
  const { weekSlug } = useParams<{ weekSlug?: string }>()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'
  const [weeks, setWeeks] = useState<Week[]>([])
  const [detail, setDetail] = useState<WeekDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingWeek, setEditingWeek] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [creatingWeek, setCreatingWeek] = useState(false)
  const [addingTag, setAddingTag] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    setLoading(true)
    if (weekSlug) {
      const match = weekSlug.match(/^woche-(\d+)$/)
      const param = match ? match[1] : weekSlug
      api.getWeek(param).then(setDetail).finally(() => setLoading(false))
    } else {
      api.listWeeks().then(setWeeks).finally(() => setLoading(false))
    }
  }, [weekSlug])

  const reload = () => {
    if (weekSlug) {
      const match = weekSlug.match(/^woche-(\d+)$/)
      const param = match ? match[1] : weekSlug
      api.getWeek(param).then(setDetail)
    }
  }

  const addTag = async () => {
    if (!detail) return
    const existing = new Set(detail.tags.map(t => t.tagNumber))
    let n = 1
    while (existing.has(n) && n <= 7) n++
    if (n > 7) return
    setAddingTag(true)
    try {
      await api.createTag(detail.id, { tagNumber: n, name: `Tag ${n}` })
      reload()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to add tag')
    } finally {
      setAddingTag(false)
    }
  }

  if (loading) return <PageSkeleton page={weekSlug ? 'detail' : 'abenteuer'} />

  if (weekSlug && detail) {
    const tagsSorted = [...detail.tags].sort((a, b) => a.tagNumber - b.tagNumber)
    const weekComplete = tagsSorted.length > 0 && tagsSorted.every(t => t.isCompleted)

    return (
      <div className="deck">
        <div>
          <button onClick={() => nav('/abenteuer')} className="deck-btn offline-allow">← All weeks</button>
        </div>
        <div className="deck-header">
          <h1>{detail.isLocked && '🔒 '}Woche {detail.number}: {detail.title}</h1>
          {isAdmin && (
            <button onClick={() => setEditingWeek(true)} className="edit-icon-btn" aria-label="Edit week">
              <PenIcon />
            </button>
          )}
        </div>
        {detail.description && <p className="hint">{detail.description}</p>}
        {detail.isLocked && (
          <p className="empty-state">🔒 Finish the previous Woche to unlock these Tage.</p>
        )}

        <h2 className="section-title">Tage</h2>
        {tagsSorted.length === 0 && (
          <p className="empty-state">No Tage yet.{isAdmin ? ' Add one below.' : ''}</p>
        )}
        <ul className="deck-list">
          {tagsSorted.map((t, i) => {
            const dayLocked = !detail.isLocked && i > 0 && !tagsSorted[i - 1].isCompleted
            return (
              <TagRow
                key={t.id}
                tag={t}
                weekLocked={detail.isLocked}
                dayLocked={dayLocked}
                isAdmin={isAdmin}
                onClick={() => nav(`/tags/${t.id}`)}
                onEdit={() => setEditingTag(t)}
              />
            )
          })}
        </ul>

        {isAdmin && tagsSorted.length < 7 && (
          <button
            onClick={addTag}
            disabled={addingTag}
            className="deck-btn"
            style={{ width: '100%', marginTop: '8px' }}
          >
            {addingTag ? 'Adding...' : `+ Add Tag ${tagsSorted.length + 1}`}
          </button>
        )}

        <button
          onClick={weekComplete ? () => nav(`/sets/weekly:${detail.number}`) : undefined}
          disabled={!weekComplete}
          className="deck-btn primary"
          style={{
            width: '100%',
            marginTop: '16px',
            justifyContent: 'space-between',
            display: 'flex',
            ...(!weekComplete ? { opacity: 0.45, pointerEvents: 'none' } : {}),
          }}
        >
          <span>{!weekComplete && '🔒 '}View all weekly words</span>
          <span aria-hidden>→</span>
        </button>

        {editingWeek && (
          <EditWeekSheet
            week={detail}
            onClose={() => setEditingWeek(false)}
            onUpdated={reload}
            onDeleted={() => nav('/abenteuer')}
          />
        )}
        {editingTag && (
          <EditTagSheet
            tag={editingTag}
            weekId={detail.id}
            onClose={() => setEditingTag(null)}
            onUpdated={() => { setEditingTag(null); reload() }}
            onDeleted={() => { setEditingTag(null); reload() }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="deck">
      <div className="deck-header">
        <div>
          <h1>Abenteuer</h1>
          <span className="deck-progress">Your German journey</span>
        </div>
      </div>
      <p className="hint">Complete each Woche to unlock the next.</p>

      {isAdmin && (
        <button onClick={() => setCreatingWeek(true)} className="app-fab" aria-label="Add week">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {creatingWeek && (
        <CreateWeekSheet
          nextNumber={(weeks[weeks.length - 1]?.number ?? 0) + 1}
          onClose={() => setCreatingWeek(false)}
          onCreated={() => api.listWeeks().then(setWeeks)}
        />
      )}

      <div className="weeks-grid">
        {weeks.map(w => {
          const denom = w.tagCount > 0 ? w.tagCount : w.setCount
          const num = w.tagCount > 0 ? w.completedTagCount : w.completedCount
          const pct = denom > 0 ? Math.round((num / denom) * 100) : 0
          const unitLabel = w.tagCount > 0 ? 'Tage' : 'sets'
          const weekDone = denom > 0 && num === denom
          return (
            <button
              key={w.id}
              onClick={() => nav(`/abenteuer/woche-${w.number}`)}
              className={`week-card ${w.isLocked ? 'week-card-locked' : ''} ${weekDone ? 'week-card--completed' : ''}`}
              style={w.isLocked ? { opacity: 0.55 } : {}}
            >
              <div className="week-card-num">{w.isLocked && '🔒 '}Woche {w.number}</div>
              <div className="week-card-title">{w.title}</div>
              {w.description && <div className="hint">{w.description}</div>}
              <div className="week-progress-bar">
                <div className="week-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="hint">
                {w.tagCount > 0
                  ? `Tag ${w.completedTagCount} / ${w.tagCount} completed`
                  : `${num} / ${denom} ${unitLabel} completed`}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TagRow({
  tag,
  weekLocked,
  dayLocked,
  isAdmin,
  onClick,
  onEdit,
}: {
  tag: Tag
  weekLocked: boolean
  dayLocked: boolean
  isAdmin: boolean
  onClick: () => void
  onEdit: () => void
}) {
  const isLocked = weekLocked || dayLocked
  const status = isLocked ? 'locked' : tag.isCompleted ? 'completed' : tag.completedStepsMask > 0 ? 'in-progress' : 'idle'

  const liClass = [
    'deck-item',
    status === 'completed' ? 'deck-item--completed' : '',
  ].filter(Boolean).join(' ')

  const metaParts: string[] = []
  if (tag.wordSetName && tag.wordCount != null) metaParts.push(`${tag.wordCount} words`)
  if (tag.readingTextTitle) {
    metaParts.push(`${tag.questionCount} Qs${tag.hasAudio ? ' 🎧' : ''}`)
  }

  return (
    <li
      className={liClass}
      style={isLocked ? { opacity: 0.45, pointerEvents: 'none' } : {}}
    >
      <StatusIcon status={status} />
      <button
        onClick={isLocked ? undefined : onClick}
        className="deck-item-main"
        disabled={isLocked}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Tag {tag.tagNumber}: {tag.name}</strong>
          {metaParts.length > 0 && (
            <span className="status-meta-pill">{metaParts.join(' · ')}</span>
          )}
        </div>
      </button>
      {isAdmin && !isLocked && (
        <button onClick={e => { e.stopPropagation(); onEdit() }} className="edit-icon-btn" aria-label="Edit tag" style={{ flexShrink: 0 }}>
          <PenIcon />
        </button>
      )}
    </li>
  )
}

function progressIcon(status: import('../api').WordSet['progressStatus']) {
  if (status === 'Completed') return <span style={{ color: 'var(--accent)' }}>✓</span>
  if (status === 'Active') return <span style={{ color: 'var(--accent)' }}>◐</span>
  return <span style={{ opacity: 0.4 }}>○</span>
}

// Keep export for any existing usages
export { progressIcon }
