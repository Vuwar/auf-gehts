type StatusType = 'completed' | 'in-progress' | 'locked' | 'idle'

interface Props {
  status: StatusType
  size?: number
}

export default function StatusIcon({ status, size = 20 }: Props) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
  }

  if (status === 'completed') {
    return (
      <span style={{ ...base, background: 'var(--status-purple)' }} aria-label="Completed">
        <svg
          width={Math.round(size * 0.52)}
          height={Math.round(size * 0.52)}
          viewBox="0 0 11 11"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="1 5.5 4 8.5 10 2" />
        </svg>
      </span>
    )
  }

  if (status === 'in-progress') {
    return (
      <span
        style={{ ...base, border: '2px solid var(--status-purple)' }}
        aria-label="In progress"
      />
    )
  }

  if (status === 'locked') {
    return (
      <span style={{ ...base, background: 'var(--border)' }} aria-label="Locked">
        <svg
          width={Math.round(size * 0.48)}
          height={Math.round(size * 0.48)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
    )
  }

  return (
    <span
      style={{ ...base, border: '1.5px solid var(--border)' }}
      aria-label="Not started"
    />
  )
}
