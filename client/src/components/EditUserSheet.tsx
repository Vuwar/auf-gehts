import { useEffect, useState } from 'react'
import { api, type UserProfile, type UserRole } from '../api'
import ConfirmationDialog from './ConfirmationDialog'

interface Props {
  user: UserProfile
  currentUserId: string
  onClose: () => void
  onUpdated: (u: UserProfile) => void
  onDeleted: (id: string) => void
}

const ROLES: { value: UserRole; label: string; description: string; icon: string }[] = [
  { value: 'Admin', label: 'Admin', description: 'Full access. Manage users, create official sets.', icon: '👑' },
  { value: 'Default', label: 'Default', description: 'Create, edit, delete own sets.', icon: '👤' },
  { value: 'ViewOnly', label: 'View only', description: 'Read-only. Can study but cannot edit.', icon: '👁️' },
]

export default function EditUserSheet({ user, currentUserId, onClose, onUpdated, onDeleted }: Props) {
  const [role, setRole] = useState<UserRole>(user.role)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isSelf = user.id === currentUserId

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const pickRole = (next: UserRole) => {
    if (next === role || isSelf) return
    setRole(next)
  }

  const save = async () => {
    if (role === user.role || isSelf) return
    setSaving(true)
    try {
      const updated = await api.adminSetUserRole(user.id, role)
      onUpdated(updated)
      onClose()
    } catch (e: unknown) {
      alert(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const deleteUser = async () => {
    setDeleting(true)
    try {
      await api.adminDeleteUser(user.id)
      onDeleted(user.id)
    } catch (e: unknown) {
      alert(errorMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>Edit user</h2>
          <button onClick={onClose} className="sheet-close" aria-label="Close">×</button>
        </header>

        <div className="sheet-body">
          <div className="user-header-block">
            <div className="user-avatar-big">{(user.displayName ?? user.email)[0]?.toUpperCase()}</div>
            <div className="user-header-text">
              <strong>{user.displayName || '—'}</strong>
              <span className="hint">{user.email}</span>
            </div>
          </div>

          <span className="card-label">Role</span>
          <div className="role-picker">
            {ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => pickRole(r.value)}
                disabled={saving || isSelf}
                className={`role-option ${role === r.value ? 'active' : ''}`}
              >
                <span className="role-icon">{r.icon}</span>
                <span className="role-text">
                  <span className="role-label">{r.label}</span>
                  <span className="role-desc">{r.description}</span>
                </span>
                {role === r.value && <span className="role-check">✓</span>}
              </button>
            ))}
          </div>
          {isSelf && <p className="hint">You cannot change your own role or delete yourself.</p>}

          {!isSelf && (
            <div className="edit-action-row">
              <button onClick={() => setConfirmingDelete(true)} className="deck-btn edit-delete-btn">
                <TrashIcon /> Delete user
              </button>
              <button onClick={save} disabled={saving || role === user.role} className="deck-btn edit-save-btn">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
          <ConfirmationDialog
            open={confirmingDelete}
            title="Delete user?"
            message={`${user.displayName || user.email} will be permanently deleted.`}
            confirmLabel="Delete user"
            busy={deleting}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={deleteUser}
          />
        </div>
      </div>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong'
}
