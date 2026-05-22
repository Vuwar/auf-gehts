import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api'
import { LockIcon } from './Icons'

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

function SvgBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

const PlugIcon = () => (
  <SvgBase>
    <path d="M9 2v6" />
    <path d="M15 2v6" />
    <path d="M6 8h12v4a6 6 0 0 1-12 0z" />
    <path d="M12 18v4" />
  </SvgBase>
)

const ToolIcon = () => (
  <SvgBase>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </SvgBase>
)

const BanIcon = () => (
  <SvgBase>
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </SvgBase>
)

const SearchIcon = () => (
  <SvgBase>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </SvgBase>
)

const KeyIcon = () => (
  <SvgBase>
    <circle cx="8" cy="15" r="4" />
    <line x1="10.85" y1="12.15" x2="19" y2="4" />
    <line x1="18" y1="5" x2="20" y2="7" />
    <line x1="15" y1="8" x2="17" y2="10" />
  </SvgBase>
)

const ClockIcon = () => (
  <SvgBase>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </SvgBase>
)

const AlertIcon = () => (
  <SvgBase>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </SvgBase>
)

function describe(error: unknown, context: Props['context']) {
  const status = error instanceof ApiError ? error.status : -1
  const message = error instanceof Error ? error.message : String(error)

  if (status === 0) {
    return {
      icon: <PlugIcon />,
      title: 'Cannot reach server',
      body: 'Check your connection or try again in a moment.',
      actionLabel: undefined,
      actionHref: undefined,
    }
  }

  if (status === 502 || status === 503 || status === 504) {
    return {
      icon: <ToolIcon />,
      title: 'Server is starting up',
      body: 'The backend is waking up. Give it a few seconds and retry.',
      actionLabel: undefined,
      actionHref: undefined,
    }
  }

  if (status === 401) {
    return {
      icon: <LockIcon size={32} />,
      title: 'Not signed in',
      body: 'Your session expired. Sign in again to continue.',
      actionLabel: 'Go to login',
      actionHref: '/login',
    }
  }

  if (status === 403) {
    return {
      icon: <BanIcon />,
      title: 'No permission',
      body: 'You don\'t have access to this.',
      actionLabel: 'Back to dashboard',
      actionHref: '/dashboard',
    }
  }

  if (status === 404) {
    if (context === 'set') {
      return {
        icon: <SearchIcon />,
        title: 'Set not found',
        body: 'This set might be private, deleted, or the link is wrong.',
        actionLabel: 'Back to Library',
        actionHref: '/library',
      }
    }
    return {
      icon: <SearchIcon />,
      title: 'Not found',
      body: 'We couldn\'t find what you were looking for.',
      actionLabel: 'Back to dashboard',
      actionHref: '/dashboard',
    }
  }

  if (context === 'ai' && (status === 400 || /api key|anthropic|gemini|groq/i.test(message))) {
    return {
      icon: <KeyIcon />,
      title: 'AI key needed',
      body: 'Add your Groq API key in Profile to generate texts, or use the free daily quota.',
      actionLabel: 'Open Profile',
      actionHref: '/profile',
    }
  }

  if (/daily limit/i.test(message)) {
    return {
      icon: <ClockIcon />,
      title: 'Daily limit reached',
      body: 'You\'ve used your free AI generations for today. Add your own API key for unlimited use.',
      actionLabel: 'Open Profile',
      actionHref: '/profile',
    }
  }

  return {
    icon: <AlertIcon />,
    title: 'Something went wrong',
    body: message || 'Unexpected error.',
    actionLabel: undefined,
    actionHref: undefined,
  }
}
