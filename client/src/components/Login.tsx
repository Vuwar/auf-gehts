import { useState } from 'react'
import { useAuth } from '../auth'
import { api } from '../api'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        if (displayName.trim()) {
          try { await api.updateMe(displayName.trim()) }
          catch (e) { console.error('Failed to set display name', e) }
        }
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">auf gehts</h1>
        <p className="auth-subtitle">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</p>

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Username"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              autoComplete="username"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={submitting} className="deck-btn primary">
            {submitting ? '...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
          className="auth-toggle"
        >
          {mode === 'signin' ? "No account? Sign up" : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
