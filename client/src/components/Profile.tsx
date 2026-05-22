import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  api,
  type FriendSummary,
  type FriendshipState,
  type PublicUserProfile,
  type Stats,
  type UserDirectoryEntry,
  type UserDirectoryPage,
  type UserProfile,
} from '../api'
import { useAuth } from '../auth'
import EditUserSheet from './EditUserSheet'
import ConfirmationDialog from './ConfirmationDialog'
import { ListSkeleton, PageSkeleton, StatsSkeleton } from './Skeletons'

const ROLE_BADGE: Record<string, { icon: string; color: string }> = {
  Admin: { icon: '👑', color: 'var(--accent)' },
  Default: { icon: '👤', color: 'var(--text)' },
  ViewOnly: { icon: '👁️', color: 'var(--text)' },
}

export default function Profile() {
  const { userId: routeUserId } = useParams<{ userId?: string }>()
  const { profile: ownProfile } = useAuth()
  const ownId = ownProfile?.id
  const isOwnView = !routeUserId || (ownId !== undefined && routeUserId === ownId)

  if (isOwnView) return <OwnProfileView />
  return <OtherProfileView userId={routeUserId!} />
}

function OwnProfileView() {
  const { profile: authProfile, refreshProfile } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(authProfile)
  const [displayName, setDisplayName] = useState(authProfile?.displayName ?? '')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [showKeySheet, setShowKeySheet] = useState(false)
  const [keySaving, setKeySaving] = useState(false)
  const [confirmClearKey, setConfirmClearKey] = useState(false)

  const [users, setUsers] = useState<UserProfile[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)

  // Lazy stats
  const [statsOpen, setStatsOpen] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  useEffect(() => {
    api.getMe().then(p => {
      setProfile(p)
      setDisplayName(p.displayName ?? '')
      if (p.role === 'Admin') loadUsers()
    })
  }, [])

  const loadUsers = async () => {
    setUsersLoading(true)
    try { setUsers(await api.adminListUsers()) }
    finally { setUsersLoading(false) }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await api.updateMe(displayName)
      setProfile(updated)
      setSavedMsg('Saved')
      setTimeout(() => setSavedMsg(null), 2000)
      refreshProfile()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const clearKey = async () => {
    const updated = await api.updateMe(undefined, '')
    setProfile(updated)
    setConfirmClearKey(false)
  }

  const saveKey = async () => {
    if (!apiKey.trim()) return
    setKeySaving(true)
    try {
      const updated = await api.updateMe(undefined, apiKey)
      setProfile(updated)
      setApiKey('')
      setShowKeySheet(false)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setKeySaving(false)
    }
  }

  const toggleStats = async () => {
    const next = !statsOpen
    setStatsOpen(next)
    if (!next || stats !== null) return
    setStatsLoading(true)
    setStatsError(null)
    try {
      setStats(await api.getStats())
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : 'Failed to load stats')
    } finally {
      setStatsLoading(false)
    }
  }

  if (!profile) return <PageSkeleton page="profile" />

  const initial = (profile.displayName || profile.email)[0]?.toUpperCase() ?? '?'

  return (
    <div className="deck">
      <div className="deck-header">
        <h1>Profile</h1>
      </div>

      <div className="profile-hero">
        <span className="user-avatar large">{initial}</span>
        <div>
          <strong>{profile.displayName || profile.email}</strong>
          <div className="streak-row">
            <span className="streak-badge">🔥 {profile.currentStreak}</span>
            <span className="hint">Longest: {profile.longestStreak}</span>
          </div>
        </div>
      </div>

      <section className="collapsible">
        <button type="button" className="collapsible-header" onClick={toggleStats} aria-expanded={statsOpen}>
          <span>📊 Stats</span>
          <span aria-hidden="true">{statsOpen ? '▾' : '▸'}</span>
        </button>
        {statsOpen && (
          <div className="collapsible-body">
            {statsLoading && <StatsSkeleton />}
            {statsError && <p className="hint" style={{ color: 'var(--danger, #c33)' }}>{statsError}</p>}
            {stats && (
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">My Vocabulary</span>
                  <span className="stat-value">{stats.vocabCount}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Active sets</span>
                  <span className="stat-value">{stats.activeSetCount}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Completed sets</span>
                  <span className="stat-value">{stats.completedSetCount}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Added this week</span>
                  <span className="stat-value">{stats.wordsAddedThisWeek}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <form onSubmit={save} className="form-row">
        <span className="card-label">Email</span>
        <p>{profile.email}</p>

        <span className="card-label">Role</span>
        <p>{profile.role}</p>

        <span className="card-label">Username</span>
        <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} />

        <span className="card-label">Groq API key</span>
        {profile.hasAnthropicKey ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--accent)' }}>✓ Key linked</span>
            <button type="button" onClick={() => setConfirmClearKey(true)} className="deck-btn danger">Remove</button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowKeySheet(true)} className="deck-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🔑</span> Link API Key
          </button>
        )}

        <button type="submit" disabled={saving} className="deck-btn primary">
          {saving ? 'Saving...' : 'Save'}
        </button>
        {savedMsg && <p style={{ color: 'var(--accent)', fontSize: '13px', margin: 0 }}>{savedMsg}</p>}
      </form>

      <FriendsSection />
      <FindPeopleSection ownId={profile.id} />

      {profile.role === 'Admin' && (
        <>
          <h2 className="section-title">Admin · Users</h2>
          {usersLoading ? (
            <ListSkeleton rows={4} withAvatar />
          ) : (
            <ul className="user-list">
              {users.map(u => {
                const badge = ROLE_BADGE[u.role] ?? ROLE_BADGE.Default
                return (
                  <li key={u.id} className="user-row" onClick={() => setEditingUser(u)}>
                    <span className="user-avatar">{(u.displayName ?? u.email)[0]?.toUpperCase()}</span>
                    <div className="user-row-text">
                      <strong>{u.displayName || '-'}</strong>
                      <span>{u.email}</span>
                    </div>
                    <span className="role-badge" style={{ color: badge.color, borderColor: badge.color }}>
                      <span>{badge.icon}</span> {u.role}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {editingUser && (
        <EditUserSheet
          user={editingUser}
          currentUserId={profile.id}
          onClose={() => setEditingUser(null)}
          onUpdated={(u) => setUsers(users.map(x => x.id === u.id ? u : x))}
          onDeleted={(id) => { setUsers(users.filter(x => x.id !== id)); setEditingUser(null) }}
        />
      )}

      {showKeySheet && (
        <div className="sheet-overlay" onClick={() => { setShowKeySheet(false); setApiKey('') }}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <h2>Link Groq API Key</h2>
              <button className="sheet-close" onClick={() => { setShowKeySheet(false); setApiKey('') }}>×</button>
            </div>
            <div className="sheet-body">
              <p className="hint" style={{ margin: 0 }}>
                Paste your key for unlimited AI text generation. Without it, you get 10 free generations per day.
              </p>
              <input
                type="password"
                placeholder="gsk_..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                autoComplete="off"
                autoFocus
              />
              <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="hint" style={{ margin: 0 }}>
                Get a free key at console.groq.com →
              </a>
              <button className="deck-btn primary" disabled={!apiKey.trim() || keySaving} onClick={saveKey}>
                {keySaving ? 'Saving...' : 'Link Key'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmationDialog
        open={confirmClearKey}
        title="Remove API key?"
        message="Your saved Groq API key will be removed from this account."
        confirmLabel="Remove key"
        onCancel={() => setConfirmClearKey(false)}
        onConfirm={clearKey}
      />
    </div>
  )
}

function FriendsSection() {
  const [friends, setFriends] = useState<FriendSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmFriend, setConfirmFriend] = useState<FriendSummary | null>(null)

  const load = useCallback(async () => {
    try {
      setFriends(await api.listFriends())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load friends')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const unfriend = async () => {
    if (!confirmFriend) return
    const prev = friends ?? []
    setFriends(prev.filter(f => f.id !== confirmFriend.id))
    try {
      await api.unfriend(confirmFriend.id)
      setConfirmFriend(null)
    } catch (e) {
      setFriends(prev)
      alert(e instanceof Error ? e.message : 'Failed to unfriend')
    }
  }

  return (
    <>
      <h2 className="section-title">Friends</h2>
      {error && <p className="hint" style={{ color: 'var(--danger, #c33)' }}>{error}</p>}
      {!friends && !error && <ListSkeleton rows={3} withAvatar />}
      {friends && friends.length === 0 && <p className="hint">No friends yet. Find people below.</p>}
      {friends && friends.length > 0 && (
        <ul className="friend-list">
          {friends.map(f => (
            <li key={f.id} className="friend-row">
              <Link to={`/profile/${f.id}`} className="user-avatar" aria-label={`Open ${f.displayName}'s profile`}>
                {f.displayName[0]?.toUpperCase() ?? '?'}
              </Link>
              <div className="friend-text">
                <Link to={`/profile/${f.id}`}><strong>{f.displayName}</strong></Link>
                {f.currentStreak > 0 && <span className="hint">🔥 {f.currentStreak} day streak</span>}
              </div>
              <button onClick={() => setConfirmFriend(f)} className="deck-btn">Unfriend</button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmationDialog
        open={!!confirmFriend}
        title="Unfriend?"
        message={`Remove ${confirmFriend?.displayName ?? 'this person'} from your friends?`}
        confirmLabel="Unfriend"
        onCancel={() => setConfirmFriend(null)}
        onConfirm={unfriend}
      />
    </>
  )
}

function FindPeopleSection({ ownId }: { ownId: string }) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState<UserDirectoryPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debouncer = useRef<number | null>(null)

  const search = useCallback(async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const resp = await api.browseUsers(query)
      setPage(resp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { search('') }, [search])

  useEffect(() => {
    if (debouncer.current) window.clearTimeout(debouncer.current)
    debouncer.current = window.setTimeout(() => { search(q) }, 250)
    return () => { if (debouncer.current) window.clearTimeout(debouncer.current) }
  }, [q, search])

  const updateRowState = (id: string, next: FriendshipState) => {
    setPage(p => p ? {
      ...p,
      items: p.items.map(it => it.id === id ? { ...it, friendshipState: next } : it),
    } : p)
  }

  const onAdd = async (entry: UserDirectoryEntry) => {
    const prev = entry.friendshipState
    updateRowState(entry.id, 'PendingOutgoing')
    try {
      const resp = await api.sendFriendRequest(entry.id)
      updateRowState(entry.id, resp.status === 'accepted' ? 'Friends' : 'PendingOutgoing')
    } catch (e) {
      updateRowState(entry.id, prev)
      alert(e instanceof Error ? e.message : 'Failed to send request')
    }
  }

  return (
    <>
      <h2 className="section-title">Find people</h2>
      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by name…"
        aria-label="Search users"
      />
      {loading && <ListSkeleton rows={3} withAvatar />}
      {error && <p className="hint" style={{ color: 'var(--danger, #c33)' }}>{error}</p>}
      {page && page.items.length === 0 && !loading && (
        <p className="hint">No users found.</p>
      )}
      {page && page.items.length > 0 && (
        <ul className="user-list">
          {page.items.filter(u => u.id !== ownId).map(u => (
            <li key={u.id} className="user-row">
              <Link to={`/profile/${u.id}`} className="user-avatar" aria-label={`Open ${u.displayName}'s profile`}>
                {u.displayName[0]?.toUpperCase() ?? '?'}
              </Link>
              <div className="user-row-text">
                <Link to={`/profile/${u.id}`}><strong>{u.displayName}</strong></Link>
              </div>
              <RelationshipAction
                state={u.friendshipState}
                onAdd={() => onAdd(u)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function RelationshipAction({ state, onAdd }: { state: FriendshipState; onAdd: () => void }) {
  if (state === 'Friends') return <span className="role-badge">✓ Friends</span>
  if (state === 'PendingOutgoing') return <span className="role-badge">Pending</span>
  if (state === 'PendingIncoming') return <span className="role-badge">Awaiting you</span>
  if (state === 'Self') return null
  return <button onClick={onAdd} className="deck-btn primary">Add friend</button>
}

function OtherProfileView({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmUnfriend, setConfirmUnfriend] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProfile(await api.getUserProfile(userId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  const initial = useMemo(
    () => (profile?.displayName ?? '?')[0]?.toUpperCase() ?? '?',
    [profile?.displayName],
  )

  if (loading) return <PageSkeleton page="profile" />
  if (error) return <div className="deck"><p className="empty-state">{error}</p></div>
  if (!profile) return <div className="deck"><p className="empty-state">Not found.</p></div>

  const sendRequest = async () => {
    setBusy(true)
    try {
      const resp = await api.sendFriendRequest(profile.id)
      setProfile({ ...profile, friendshipState: resp.status === 'accepted' ? 'Friends' : 'PendingOutgoing' })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send request')
    } finally {
      setBusy(false)
    }
  }

  const cancelOutgoing = async () => {
    setBusy(true)
    try {
      const reqs = await api.listFriendRequests()
      const row = reqs.outgoing.find(r => r.otherUserId === profile.id)
      if (row) await api.cancelFriendRequest(row.id)
      setProfile({ ...profile, friendshipState: 'None' })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to cancel')
    } finally {
      setBusy(false)
    }
  }

  const respond = async (accept: boolean) => {
    setBusy(true)
    try {
      const reqs = await api.listFriendRequests()
      const row = reqs.incoming.find(r => r.otherUserId === profile.id)
      if (!row) throw new Error('Request not found')
      if (accept) await api.acceptFriendRequest(row.id)
      else await api.declineFriendRequest(row.id)
      setProfile({ ...profile, friendshipState: accept ? 'Friends' : 'Declined' })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to respond')
    } finally {
      setBusy(false)
    }
  }

  const unfriend = async () => {
    setBusy(true)
    try {
      await api.unfriend(profile.id)
      setProfile({ ...profile, friendshipState: 'None' })
      setConfirmUnfriend(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to unfriend')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="deck">
      <div className="deck-header">
        <h1>{profile.displayName}</h1>
      </div>

      <div className="profile-hero">
        <span className="user-avatar large">{initial}</span>
        <div>
          <strong>{profile.displayName}</strong>
          <div className="streak-row">
            <span className="streak-badge">🔥 {profile.currentStreak}</span>
            <span className="hint">Longest: {profile.longestStreak}</span>
          </div>
        </div>
      </div>

      <div className="profile-actions">
        {profile.friendshipState === 'None' && (
          <button onClick={sendRequest} disabled={busy} className="deck-btn primary">Add friend</button>
        )}
        {profile.friendshipState === 'Declined' && (
          <button onClick={sendRequest} disabled={busy} className="deck-btn primary">Add friend</button>
        )}
        {profile.friendshipState === 'PendingOutgoing' && (
          <button onClick={cancelOutgoing} disabled={busy} className="deck-btn">Cancel request</button>
        )}
        {profile.friendshipState === 'PendingIncoming' && (
          <>
            <button onClick={() => respond(true)} disabled={busy} className="deck-btn primary">Accept</button>
            <button onClick={() => respond(false)} disabled={busy} className="deck-btn">Decline</button>
          </>
        )}
        {profile.friendshipState === 'Friends' && (
          <button onClick={() => setConfirmUnfriend(true)} disabled={busy} className="deck-btn danger">Unfriend</button>
        )}
      </div>
      <ConfirmationDialog
        open={confirmUnfriend}
        title="Unfriend?"
        message={`Remove ${profile.displayName} from your friends?`}
        confirmLabel="Unfriend"
        busy={busy}
        onCancel={() => setConfirmUnfriend(false)}
        onConfirm={unfriend}
      />
    </div>
  )
}

