import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api } from '../api'

export default function Login() {
  const { signIn, signUp, user } = useAuth()
  const location = useLocation()
  const nav = useNavigate()
  const isSignup = location.pathname === '/signup'

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (isSignup) {
        await signUp(email, password)
        if (displayName.trim()) {
          try { await api.updateMe(displayName.trim()) }
          catch (e) { console.error('Failed to set username', e) }
        }
      } else {
        await signIn(email, password)
      }
      nav('/dashboard', { replace: true })
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
        <p className="auth-subtitle">{isSignup ? 'Create your account' : 'Welcome back'}</p>

        <form onSubmit={submit} className="auth-form">
          {isSignup && (
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
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={submitting} className="deck-btn primary">
            {submitting ? '...' : isSignup ? 'Sign up' : 'Sign in'}
          </button>
        </form>

        <Link to={isSignup ? '/login' : '/signup'} className="auth-toggle">
          {isSignup ? 'Have an account? Sign in' : 'No account? Sign up'}
        </Link>
      </div>
    </div>
  )
}
