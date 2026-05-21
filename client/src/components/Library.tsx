import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Library as LibraryData, type WordSet } from '../api'
import { useAuth } from '../auth'
import ErrorView from './ErrorView'
import CreateSetSheet from './CreateSetSheet'
import { PageSkeleton } from './Skeletons'
import StatusIcon from './StatusIcon'

export default function Library() {
  const nav = useNavigate()
  const { profile } = useAuth()
  const canCreate = profile?.role !== 'ViewOnly'

  const [data, setData] = useState<LibraryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [creating, setCreating] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.getLibrary())
    } catch (e) {
      setError(e)
    } finally { setLoading(false) }
  }

  if (loading) return <PageSkeleton page="library" />
  if (error) return <div className="deck"><ErrorView error={error} onRetry={load} /></div>
  if (!data) return null

  return (
    <div className="deck">
      <div className="deck-header">
        <h1>Library</h1>
        {canCreate && (
          <button onClick={() => setCreating(true)} className="deck-btn primary">+ Create set</button>
        )}
      </div>

      <Section title="Favorites" sets={data.favorites} emptyMsg="No favorites yet. Tap the heart on any set." onClick={s => nav(`/sets/${s.slug}`)} showMineChip />
      <Section title="My sets" sets={data.mine} emptyMsg="You haven't created any sets yet." onClick={s => nav(`/sets/${s.slug}`)} />
      <Section title="Completed" sets={data.completed} emptyMsg="No completed sets yet." onClick={s => nav(`/sets/${s.slug}`)} collapsible open={completedOpen} onToggle={() => setCompletedOpen(!completedOpen)} />
      <Section title="Browse sets" sets={data.browse} emptyMsg="No other public sets right now." onClick={s => nav(`/sets/${s.slug}`)} collapsible open={browseOpen} onToggle={() => setBrowseOpen(!browseOpen)} />

      {creating && (
        <CreateSetSheet
          onClose={() => setCreating(false)}
          onCreated={slug => nav(`/sets/${slug}`)}
        />
      )}
    </div>
  )
}

interface SectionProps {
  title: string
  sets: WordSet[]
  emptyMsg: string
  onClick: (s: WordSet) => void
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
  showMineChip?: boolean
}

function Section({ title, sets, emptyMsg, onClick, collapsible, open, onToggle, showMineChip }: SectionProps) {
  const header = collapsible ? (
    <button onClick={onToggle} className="section-header section-header-toggle">
      <span className="section-title">{title} <span className="hint">({sets.length})</span></span>
      <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-flex' }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </button>
  ) : (
    <div className="section-header">
      <h2 className="section-title">{title} <span className="hint">({sets.length})</span></h2>
    </div>
  )

  const body = sets.length === 0 ? (
    <p className="hint">{emptyMsg}</p>
  ) : (
    <ul className="deck-list">
      {sets.map(s => <SetRow key={s.id} set={s} onClick={onClick} showMineChip={showMineChip} />)}
    </ul>
  )

  return (
    <>
      {header}
      {(!collapsible || open) && body}
    </>
  )
}

function SetRow({ set, onClick, showMineChip }: { set: WordSet; onClick: (s: WordSet) => void; showMineChip?: boolean }) {
  const isCompleted = set.progressStatus === 'Completed'
  const isActive = set.progressStatus === 'Active'
  const rowClass = `deck-item deck-item--wordset${isCompleted ? ' deck-item--completed' : ''}`
  const iconStatus = isCompleted ? 'completed' : isActive ? 'in-progress' : null
  return (
    <li className={rowClass}>
      {iconStatus ? (
        <StatusIcon status={iconStatus} />
      ) : (
        <span className="deck-item-icon" aria-hidden>
          <WordSetIcon />
        </span>
      )}
      <button onClick={() => onClick(set)} className="deck-item-main">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{set.name}</span>
          {set.isFavorite && <span className="starter-level" title="Favorited">♥</span>}
          {showMineChip && set.isOwner && <span className="starter-level" title="Your set">Mine</span>}
          {set.weekNumber && <span className="starter-level">W{set.weekNumber}</span>}
          {set.level && <span className="starter-level">{set.level}</span>}
          {!set.isPublic && !set.isOfficial && <span className="starter-level">private</span>}
          <span className="deck-item-count">· {set.wordCount} words</span>
        </div>
      </button>
    </li>
  )
}

function WordSetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}
