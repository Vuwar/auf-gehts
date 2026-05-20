import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type Week, type WeekDetail, type WordSet, type Tag } from '../api'
import { useAuth } from '../auth'
import EditWeekSheet from './EditWeekSheet'
import CreateSetForWeekSheet from './CreateSetForWeekSheet'
import AssignExistingSetSheet from './AssignExistingSetSheet'
import CreateWeekSheet from './CreateWeekSheet'
import ConfirmationDialog from './ConfirmationDialog'
import { PageSkeleton } from './Skeletons'

export default function Abenteuer() {
  const { weekSlug } = useParams<{ weekSlug?: string }>()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'Admin'
  const [weeks, setWeeks] = useState<Week[]>([])
  const [detail, setDetail] = useState<WeekDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingWeek, setEditingWeek] = useState(false)
  const [creatingSet, setCreatingSet] = useState(false)
  const [assigningExisting, setAssigningExisting] = useState(false)
  const [creatingWeek, setCreatingWeek] = useState(false)
  const [confirmDeleteSet, setConfirmDeleteSet] = useState<WordSet | null>(null)
  const [deletingSet, setDeletingSet] = useState(false)
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

  const deleteSet = async () => {
    if (!confirmDeleteSet) return
    setDeletingSet(true)
    try {
      await api.deleteSet(confirmDeleteSet.id)
      setConfirmDeleteSet(null)
      reload()
    } finally {
      setDeletingSet(false)
    }
  }

  if (loading) return <PageSkeleton page={weekSlug ? 'detail' : 'abenteuer'} />

  if (weekSlug && detail) {
    return (
      <div className="deck">
        <div>
          <button onClick={() => nav('/abenteuer')} className="deck-btn">← All weeks</button>
        </div>
        <div className="deck-header">
          <h1>{detail.isLocked && '🔒 '}Woche {detail.number}: {detail.title}</h1>
          {isAdmin && (
            <button onClick={() => setEditingWeek(true)} className="deck-btn">Edit week</button>
          )}
        </div>
        {detail.description && <p className="hint">{detail.description}</p>}
        {detail.isLocked && (
          <p className="empty-state">🔒 Finish the previous Woche to unlock these Tage. You can preview but not start.</p>
        )}

        <h2 className="section-title">Tage</h2>
        {detail.tags.length === 0 && <p className="empty-state">No Tage yet.{isAdmin ? ' Add via Edit week.' : ''}</p>}
        <ul className="deck-list">
          {detail.tags.sort((a, b) => a.tagNumber - b.tagNumber).map(t => (
            <TagRow key={t.id} tag={t} locked={detail.isLocked} onClick={() => !detail.isLocked && nav(`/tags/${t.id}`)} />
          ))}
        </ul>

        <h2 className="section-title">Word sets</h2>
        {detail.sets.length === 0 && <p className="empty-state">No sets yet.</p>}
        <ul className="deck-list">
          {detail.sets.map(s => (
            <li key={s.id} className="deck-item">
              <button onClick={() => nav(`/sets/${s.slug}`)} className="deck-item-main">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {progressIcon(s.progressStatus)}
                  <span>{s.name}</span>
                  {s.level && <span className="starter-level">{s.level}</span>}
                  <span className="deck-item-count">· {s.wordCount} words</span>
                </div>
                {s.description && <div className="hint" style={{ marginTop: '4px' }}>{s.description}</div>}
              </button>
              {isAdmin && (
                <button onClick={() => setConfirmDeleteSet(s)} className="deck-btn danger" aria-label="Delete set">×</button>
              )}
            </li>
          ))}
        </ul>
        <ConfirmationDialog
          open={!!confirmDeleteSet}
          title="Delete set?"
          message={`"${confirmDeleteSet?.name ?? 'This set'}" and its words will be permanently deleted.`}
          confirmLabel="Delete set"
          busy={deletingSet}
          onCancel={() => setConfirmDeleteSet(null)}
          onConfirm={deleteSet}
        />

        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button onClick={() => setCreatingSet(true)} className="deck-btn primary">+ New set</button>
            <button onClick={() => setAssigningExisting(true)} className="deck-btn">Assign existing</button>
          </div>
        )}

        {detail.sets.length > 0 && (
          <button
            onClick={() => nav(`/sets/weekly:${detail.number}`)}
            className="deck-btn primary"
            style={{ width: '100%', marginTop: '8px', justifyContent: 'space-between', display: 'flex' }}
          >
            <span>View all weekly words</span>
            <span aria-hidden>→</span>
          </button>
        )}

        <h2 className="section-title">Reading texts</h2>
        {detail.readingTexts.length === 0 && <p className="empty-state">No texts assigned to this week.</p>}
        <ul className="deck-list">
          {detail.readingTexts.map(t => (
            <li key={t.id} className="deck-item">
              <button onClick={() => nav(`/reader/${t.id}`)} className="deck-item-main">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{t.title}</span>
                  {t.level && <span className="starter-level">{t.level}</span>}
                  <span className="deck-item-count">· {t.questionCount} questions · {t.charCount} chars</span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {editingWeek && (
          <EditWeekSheet
            week={detail}
            onClose={() => setEditingWeek(false)}
            onUpdated={reload}
            onDeleted={() => nav('/abenteuer')}
          />
        )}
        {creatingSet && (
          <CreateSetForWeekSheet
            weekId={detail.id}
            onClose={() => setCreatingSet(false)}
            onCreated={reload}
          />
        )}
        {assigningExisting && (
          <AssignExistingSetSheet
            weekId={detail.id}
            onClose={() => setAssigningExisting(false)}
            onAssigned={reload}
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
        {isAdmin && (
          <button onClick={() => setCreatingWeek(true)} className="deck-btn primary">+ Add week</button>
        )}
      </div>
      <p className="hint">Complete each Woche to unlock the next.</p>

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
          return (
            <button
              key={w.id}
              onClick={() => nav(`/abenteuer/woche-${w.number}`)}
              className={`week-card ${w.isLocked ? 'week-card-locked' : ''}`}
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

function TagRow({ tag, locked, onClick }: { tag: Tag; locked: boolean; onClick: () => void }) {
  const icon = locked ? '🔒' : tag.isCompleted ? '✓' : tag.completedStepsMask > 0 ? '◐' : '○'
  return (
    <li className="deck-item" style={locked ? { opacity: 0.55 } : {}}>
      <button onClick={onClick} className="deck-item-main" disabled={locked}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: tag.isCompleted ? 'var(--accent)' : undefined }}>{icon}</span>
          <strong>Tag {tag.tagNumber}: {tag.name}</strong>
          {tag.wordSetName && <span className="deck-item-count">· {tag.wordCount ?? 0} words</span>}
          {tag.readingTextTitle && <span className="deck-item-count">· {tag.questionCount} Qs {tag.hasAudio ? '🎧' : ''}</span>}
        </div>
      </button>
    </li>
  )
}

function progressIcon(status: WordSet['progressStatus']) {
  if (status === 'Completed') return <span style={{ color: 'var(--accent)' }}>✓</span>
  if (status === 'Active') return <span style={{ color: 'var(--accent)' }}>◐</span>
  return <span style={{ opacity: 0.4 }}>○</span>
}
