import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ActivityLogEntry, type ActivityLogsPage, type ActivityTypeCount } from '../api'
import { ListSkeleton } from './Skeletons'

// Friendly rendering for each activity event type. `label` is the verb phrase shown
// after the user's name; `icon` is a small visual marker.
const ACTIVITY_META: Record<string, { icon: string; label: string }> = {
  'activity.signup': { icon: '✨', label: 'signed up' },
  'activity.app_open': { icon: '🚪', label: 'opened the app' },
  'activity.wordset.created': { icon: '📝', label: 'created word set' },
  'activity.wordset.updated': { icon: '✏️', label: 'edited word set' },
  'activity.wordset.deleted': { icon: '🗑️', label: 'deleted word set' },
  'activity.wordset.completed': { icon: '✅', label: 'completed word set' },
  'activity.text.created': { icon: '📄', label: 'created text' },
  'activity.text.updated': { icon: '✏️', label: 'edited text' },
  'activity.text.deleted': { icon: '🗑️', label: 'deleted text' },
  'activity.user.role_changed': { icon: '👑', label: 'changed a role' },
  'activity.user.deleted': { icon: '🚫', label: 'deleted a user' },
}

const WINDOWS: { label: string; days: number | null }[] = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: 'All', days: null },
]

const PAGE_SIZE = 50

function metaFor(eventType: string) {
  return ACTIVITY_META[eventType] ?? { icon: '•', label: eventType.replace(/^activity\./, '') }
}

// Pull a human-readable target ("My Set", "Reading 3") out of the metadata blob.
function targetOf(entry: ActivityLogEntry): string | null {
  if (!entry.metadataJson) return entry.message
  try {
    const m = JSON.parse(entry.metadataJson) as Record<string, unknown>
    const t = m.name ?? m.title ?? m.targetEmail ?? m.role ?? m.email
    return typeof t === 'string' ? t : entry.message
  } catch {
    return entry.message
  }
}

// `userId` scopes the feed to a single user's own actions (rendered on their profile).
export default function AdminActivity({ userId }: { userId?: string }) {
  const [page, setPage] = useState<ActivityLogsPage | null>(null)
  const [types, setTypes] = useState<ActivityTypeCount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [eventType, setEventType] = useState('')
  const [search, setSearch] = useState('')
  const [windowDays, setWindowDays] = useState<number | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const debouncer = useRef<number | null>(null)

  // Reset paging whenever we switch which user we're looking at.
  useEffect(() => { setPageNum(1) }, [userId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const since = windowDays === null
        ? undefined
        : new Date(Date.now() - windowDays * 86_400_000).toISOString()
      const resp = await api.adminActivityLogs({
        userId,
        eventType: eventType || undefined,
        search: search.trim() || undefined,
        since,
        page: pageNum,
        pageSize: PAGE_SIZE,
      })
      setPage(resp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [userId, eventType, search, windowDays, pageNum])

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    if (debouncer.current) window.clearTimeout(debouncer.current)
    debouncer.current = window.setTimeout(() => { load() }, 250)
    return () => { if (debouncer.current) window.clearTimeout(debouncer.current) }
  }, [load])

  useEffect(() => { api.adminActivityTypes(90).then(setTypes).catch(() => {}) }, [])

  const totalPages = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1

  return (
    <div className="admin-activity">
      <div className="form-row logs-filters">
        <select
          value={eventType}
          onChange={e => { setEventType(e.target.value); setPageNum(1) }}
        >
          <option value="">All events</option>
          {types.map(t => (
            <option key={t.eventType} value={t.eventType}>
              {metaFor(t.eventType).label} ({t.count})
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={e => { setSearch(e.target.value); setPageNum(1) }}
          placeholder={userId ? 'Search set / text…' : 'Search name / set / text…'}
          aria-label="Search activity"
        />
        <div className="logs-window-picker">
          {WINDOWS.map(w => (
            <button
              key={w.label}
              type="button"
              onClick={() => { setWindowDays(w.days); setPageNum(1) }}
              className={`tab-toggle-btn ${windowDays === w.days ? 'active' : ''}`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="hint" style={{ color: 'var(--danger, #c33)' }}>{error}</p>}
      {!page && loading && <ListSkeleton rows={6} />}
      {page && page.items.length === 0 && !loading && (
        <p className="empty-state">No activity in this window.</p>
      )}
      {page && page.items.length > 0 && (
        <ul className="activity-feed">
          {page.items.map(entry => <ActivityRow key={entry.id} entry={entry} showUser={!userId} />)}
        </ul>
      )}

      {page && page.total > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
          <p className="hint">{page.total} events · page {pageNum} / {totalPages}</p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button disabled={pageNum <= 1} onClick={() => setPageNum(pageNum - 1)} className="deck-btn">← Prev</button>
            <button disabled={pageNum >= totalPages} onClick={() => setPageNum(pageNum + 1)} className="deck-btn">Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ActivityRow({ entry, showUser }: { entry: ActivityLogEntry; showUser: boolean }) {
  const meta = metaFor(entry.eventType)
  const target = targetOf(entry)
  const when = new Date(entry.timestamp)
  const name = entry.userName ?? entry.userEmail ?? 'Unknown user'
  // When scoped to one profile (showUser=false) the verb leads with a capital.
  const label = showUser ? meta.label : meta.label.charAt(0).toUpperCase() + meta.label.slice(1)

  return (
    <li className="activity-row">
      <span className="activity-icon" aria-hidden="true">{meta.icon}</span>
      <div className="activity-text">
        <span>
          {showUser && (
            <>
              {entry.userId
                ? <Link to={`/profile/${entry.userId}`}><strong>{name}</strong></Link>
                : <strong>{name}</strong>}
              {' '}
            </>
          )}
          {label}
          {target && <> <span className="activity-target">“{target}”</span></>}
        </span>
        {showUser && entry.userEmail && entry.userName && (
          <span className="hint">{entry.userEmail}</span>
        )}
      </div>
      <time className="activity-time" dateTime={entry.timestamp} title={when.toString()}>
        {when.toLocaleString()}
      </time>
    </li>
  )
}
