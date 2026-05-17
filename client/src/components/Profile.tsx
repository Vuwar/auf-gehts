import { useEffect, useState } from 'react'
import { api, type UserProfile } from '../api'
import EditUserSheet from './EditUserSheet'

const ROLE_BADGE: Record<string, { icon: string; color: string }> = {
  Admin: { icon: '👑', color: 'var(--accent)' },
  Default: { icon: '👤', color: 'var(--text)' },
  ViewOnly: { icon: '👁️', color: 'var(--text)' },
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const [users, setUsers] = useState<UserProfile[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)

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
      const updated = await api.updateMe(displayName, apiKey || undefined)
      setProfile(updated)
      setApiKey('')
      setSavedMsg('Saved')
      setTimeout(() => setSavedMsg(null), 2000)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const clearKey = async () => {
    if (!confirm('Remove your Anthropic API key?')) return
    const updated = await api.updateMe(undefined, '')
    setProfile(updated)
  }


  if (!profile) return <p className="empty-state">Loading...</p>

  return (
    <div className="deck">
      <div className="deck-header">
        <h1>Profile</h1>
      </div>

      <form onSubmit={save} className="form-row">
        <span className="card-label">Email</span>
        <p>{profile.email}</p>

        <span className="card-label">Role</span>
        <p>{profile.role}</p>

        <span className="card-label">Username</span>
        <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} />

        <span className="card-label">Anthropic API key (optional)</span>
        <p className="hint">
          Provide your own key for unlimited AI text generation. Without it, you get 10 free generations per day.
          Get a key at <code>console.anthropic.com</code>.
        </p>
        {profile.hasAnthropicKey ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--accent)' }}>✓ Key set</span>
            <button type="button" onClick={clearKey} className="deck-btn danger">Remove</button>
          </div>
        ) : (
          <input
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            autoComplete="off"
          />
        )}

        <button type="submit" disabled={saving} className="deck-btn primary">
          {saving ? 'Saving...' : 'Save'}
        </button>
        {savedMsg && <p style={{ color: 'var(--accent)', fontSize: '13px', margin: 0 }}>{savedMsg}</p>}
      </form>

      {profile.role === 'Admin' && (
        <>
          <h2 className="section-title">Admin · Users</h2>
          {usersLoading ? (
            <p className="hint">Loading users...</p>
          ) : (
            <ul className="user-list">
              {users.map(u => {
                const badge = ROLE_BADGE[u.role] ?? ROLE_BADGE.Default
                return (
                  <li key={u.id} className="user-row" onClick={() => setEditingUser(u)}>
                    <span className="user-avatar">{(u.displayName ?? u.email)[0]?.toUpperCase()}</span>
                    <div className="user-row-text">
                      <strong>{u.displayName || '—'}</strong>
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
    </div>
  )
}
