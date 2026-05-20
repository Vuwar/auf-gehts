type SkeletonPage = 'dashboard' | 'library' | 'abenteuer' | 'detail' | 'reader' | 'profile'

export function SkeletonLine({ width = '100%', className = '' }: { width?: string; className?: string }) {
  return <span className={`skeleton-line ${className}`} style={{ width }} aria-hidden="true" />
}

export function SkeletonAvatar({ large = false }: { large?: boolean }) {
  return <span className={`skeleton-avatar ${large ? 'large' : ''}`} aria-hidden="true" />
}

export function AppShellSkeleton() {
  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand">
          <span className="brand-mark skeleton-block" />
          <span className="brand-text"><SkeletonLine width="74px" /></span>
        </div>
        <div className="top-bar-nav skeleton-nav">
          <SkeletonLine width="84px" />
          <SkeletonLine width="96px" />
          <SkeletonLine width="74px" />
        </div>
        <div className="top-bar-right">
          <SkeletonAvatar />
        </div>
      </div>
      <main className="app-content">
        <PageSkeleton page="dashboard" />
      </main>
    </div>
  )
}

export function PageSkeleton({ page = 'detail' }: { page?: SkeletonPage }) {
  if (page === 'dashboard') return <DashboardSkeleton />
  if (page === 'library') return <LibrarySkeleton />
  if (page === 'abenteuer') return <AbenteuerSkeleton />
  if (page === 'reader') return <ReaderSkeleton />
  if (page === 'profile') return <ProfileSkeleton />
  return <DetailSkeleton />
}

export function ListSkeleton({ rows = 4, withAvatar = false }: { rows?: number; withAvatar?: boolean }) {
  return (
    <ul className="deck-list skeleton-list" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="deck-item skeleton-row">
          {withAvatar && <SkeletonAvatar />}
          <div className="skeleton-row-body">
            <SkeletonLine width={i % 2 === 0 ? '62%' : '48%'} />
            <SkeletonLine width={i % 2 === 0 ? '38%' : '56%'} className="short" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function StatsSkeleton() {
  return (
    <div className="stats-grid" aria-label="Loading stats">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="stat-card">
          <SkeletonLine width="70%" />
          <SkeletonLine width="36px" className="big" />
        </div>
      ))}
    </div>
  )
}

export function PopupSkeleton() {
  return (
    <div className="lookup-skeleton" aria-label="Loading lookup">
      <SkeletonLine width="44%" className="big" />
      <SkeletonLine width="72%" />
      <SkeletonLine width="88%" />
      <SkeletonLine width="64%" />
      <SkeletonLine width="100%" className="input" />
      <SkeletonLine width="46%" className="button" />
    </div>
  )
}

export function RequestsSkeleton() {
  return (
    <div className="requests-skeleton" aria-label="Loading friend requests">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="requests-bell-row">
          <SkeletonAvatar />
          <SkeletonLine width={i === 0 ? '120px' : '92px'} />
          <SkeletonLine width="68px" className="button" />
        </div>
      ))}
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <div className="deck-header">
      <div className="skeleton-title-stack">
        <SkeletonLine width="180px" className="title" />
        <SkeletonLine width="140px" />
      </div>
      <SkeletonLine width="110px" className="button" />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="deck" aria-label="Loading dashboard">
      <HeaderSkeleton />
      <div className="streak-hero"><SkeletonAvatar /><div className="skeleton-row-body"><SkeletonLine width="96px" className="big" /><SkeletonLine width="150px" /></div></div>
      <div className="homework-card skeleton-card"><SkeletonLine width="38%" /><SkeletonLine width="68%" className="big" /><SkeletonLine width="52%" /><SkeletonLine width="132px" className="button" /></div>
      <ListSkeleton rows={3} withAvatar />
      <div className="action-grid">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="action-card skeleton-card"><SkeletonLine width="32px" className="icon" /><SkeletonLine width="70%" /><SkeletonLine width="90%" /></div>)}
      </div>
    </div>
  )
}

function LibrarySkeleton() {
  return (
    <div className="deck" aria-label="Loading library">
      <HeaderSkeleton />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton-section">
          <SkeletonLine width={i === 0 ? '110px' : '140px'} className="title" />
          <ListSkeleton rows={2} />
        </div>
      ))}
    </div>
  )
}

function AbenteuerSkeleton() {
  return (
    <div className="deck" aria-label="Loading adventure">
      <HeaderSkeleton />
      <SkeletonLine width="260px" />
      <div className="weeks-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="week-card skeleton-card">
            <SkeletonLine width="70px" />
            <SkeletonLine width={i % 2 ? '72%' : '58%'} className="big" />
            <SkeletonLine width="88%" />
            <SkeletonLine width="100%" className="progress" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ReaderSkeleton() {
  return (
    <div className="deck" aria-label="Loading reader">
      <HeaderSkeleton />
      <div className="form-row"><SkeletonLine width="100%" className="input" /><SkeletonLine width="100%" className="button" /></div>
      <ListSkeleton rows={5} />
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="deck" aria-label="Loading details">
      <SkeletonLine width="96px" className="button" />
      <HeaderSkeleton />
      <div className="meta-pills">
        <SkeletonLine width="74px" className="pill" />
        <SkeletonLine width="64px" className="pill" />
        <SkeletonLine width="90px" className="pill" />
      </div>
      <ListSkeleton rows={6} />
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="deck" aria-label="Loading profile">
      <HeaderSkeleton />
      <div className="profile-hero"><SkeletonAvatar large /><div className="skeleton-row-body"><SkeletonLine width="160px" className="big" /><SkeletonLine width="120px" /></div></div>
      <div className="form-row"><SkeletonLine width="80px" /><SkeletonLine width="100%" className="input" /><SkeletonLine width="64px" /><SkeletonLine width="100%" className="input" /></div>
      <ListSkeleton rows={3} withAvatar />
    </div>
  )
}
