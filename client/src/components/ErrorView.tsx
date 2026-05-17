import { Link } from 'react-router-dom'
import { ApiError } from '../api'

interface Props {
  error: unknown
  context?: 'set' | 'ai' | 'generic'
  compact?: boolean
  onRetry?: () => void
}

export default function ErrorView({ error, context = 'generic', compact = false, onRetry }: Props) {
  const { icon, title, body, actionLabel, actionHref } = describe(error, context)

  if (compact) {
    return (
      <div className="error-view error-compact">
        <span className="error-compact-icon">{icon}</span>
        <div className="error-compact-text">
          <strong>{title}</strong>
          <span>{body}</span>
        </div>
        <div className="error-compact-actions">
          {actionHref && actionLabel && (
            <Link to={actionHref} className="deck-btn primary">{actionLabel}</Link>
          )}
          {onRetry && (
            <button onClick={onRetry} className="deck-btn">Try again</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="error-view">
      <div className="error-icon">{icon}</div>
      <h2 className="error-title">{title}</h2>
      <p className="error-body">{body}</p>
      <div className="error-actions">
        {actionHref && actionLabel && (
          <Link to={actionHref} className="deck-btn primary">{actionLabel}</Link>
        )}
        {onRetry && (
          <button onClick={onRetry} className="deck-btn">Try again</button>
        )}
      </div>
    </div>
  )
}

function describe(error: unknown, context: Props['context']) {
  const status = error instanceof ApiError ? error.status : -1
  const message = error instanceof Error ? error.message : String(error)

  if (status === 0) {
    return {
      icon: '🔌',
      title: 'Cannot reach server',
      body: 'Check your connection or try again in a moment.',
      actionLabel: undefined,
      actionHref: undefined,
    }
  }

  if (status === 502 || status === 503 || status === 504) {
    return {
      icon: '🛠️',
      title: 'Server is starting up',
      body: 'The backend is waking up. Give it a few seconds and retry.',
      actionLabel: undefined,
      actionHref: undefined,
    }
  }

  if (status === 401) {
    return {
      icon: '🔒',
      title: 'Not signed in',
      body: 'Your session expired. Sign in again to continue.',
      actionLabel: 'Go to login',
      actionHref: '/login',
    }
  }

  if (status === 403) {
    return {
      icon: '🚫',
      title: 'No permission',
      body: 'You don\'t have access to this.',
      actionLabel: 'Back to dashboard',
      actionHref: '/dashboard',
    }
  }

  if (status === 404) {
    if (context === 'set') {
      return {
        icon: '🔍',
        title: 'Set not found',
        body: 'This set might be private, deleted, or the link is wrong.',
        actionLabel: 'Back to Library',
        actionHref: '/library',
      }
    }
    return {
      icon: '🔍',
      title: 'Not found',
      body: 'We couldn\'t find what you were looking for.',
      actionLabel: 'Back to dashboard',
      actionHref: '/dashboard',
    }
  }

  if (context === 'ai' && (status === 400 || /api key|anthropic|gemini|groq/i.test(message))) {
    return {
      icon: '🔑',
      title: 'AI key needed',
      body: 'Add your Groq API key in Profile to generate texts, or use the free daily quota.',
      actionLabel: 'Open Profile',
      actionHref: '/profile',
    }
  }

  if (/daily limit/i.test(message)) {
    return {
      icon: '⏳',
      title: 'Daily limit reached',
      body: 'You\'ve used your free AI generations for today. Add your own API key for unlimited use.',
      actionLabel: 'Open Profile',
      actionHref: '/profile',
    }
  }

  return {
    icon: '⚠️',
    title: 'Something went wrong',
    body: message || 'Unexpected error.',
    actionLabel: undefined,
    actionHref: undefined,
  }
}
