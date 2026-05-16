import { useEffect, useState } from 'react'
import { api, type UserProfile } from '../api'

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    api.getMe().then(p => {
      setProfile(p)
      setDisplayName(p.displayName ?? '')
    })
  }, [])

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

        <span className="card-label">Display name</span>
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
    </div>
  )
}
