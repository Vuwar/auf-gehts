import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { useEffect, useRef, type ReactNode } from 'react'
import { api } from './api'
import Library from './components/Library'
import WordSetView from './components/WordSetView'
import Dashboard from './components/Dashboard'
import Reader from './components/Reader'
import ReaderDetail from './components/ReaderDetail'
import AdminLogs from './components/AdminLogs'
import Profile from './components/Profile'
import Login from './components/Login'
import Abenteuer from './components/Abenteuer'
import TagFlow from './components/TagFlow'
import UserMenu, { StreakIndicator } from './components/UserMenu'
import RequestsBell from './components/RequestsBell'
import Alphabet from './components/Alphabet'
import LoadingBar from './components/LoadingBar'
import OfflineIndicator from './components/OfflineIndicator'
import InstallPrompt from './components/InstallPrompt'
import PWAUpdatePrompt from './components/PWAUpdatePrompt'
import { AppShellSkeleton } from './components/Skeletons'
import { AuthProvider, useAuth } from './auth'
import './App.css'

function TopBar() {
  return (
    <header className="top-bar">
      <Link to="/dashboard" className="brand" aria-label="Home">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 17 18 12 13 7" />
            <polyline points="6 17 11 12 6 7" />
          </svg>
        </span>
        <span className="brand-text">
          <span>auf</span>
          <span className="brand-text-accent">gehts</span>
        </span>
      </Link>
      <nav className="top-bar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `top-bar-link ${isActive ? 'active' : ''}`}><NavIcon name="home" />Dashboard</NavLink>
        <NavLink to="/abenteuer" className={({ isActive }) => `top-bar-link ${isActive ? 'active' : ''}`}><NavIcon name="map" />Abenteuer</NavLink>
        <NavLink to="/library" className={({ isActive }) => `top-bar-link ${isActive ? 'active' : ''}`}><NavIcon name="book" />Library</NavLink>
        <NavLink to="/reader" className={({ isActive }) => `top-bar-link ${isActive ? 'active' : ''}`}><NavIcon name="reader" />Reader</NavLink>
      </nav>
      <div className="top-bar-right">
        <StreakIndicator />
        <RequestsBell />
        <UserMenu />
      </div>
    </header>
  )
}

function BottomNav() {
  const items: { to: string; label: string; icon: NavIconName }[] = [
    { to: '/dashboard', label: 'Home', icon: 'home' },
    { to: '/abenteuer', label: 'Abenteuer', icon: 'map' },
    { to: '/library', label: 'Library', icon: 'book' },
    { to: '/reader', label: 'Reader', icon: 'reader' },
  ]
  return (
    <nav className="bottom-nav">
      {items.map(it => (
        <NavLink key={it.to} to={it.to} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <NavIcon name={it.icon} />
          <span className="bottom-nav-label">{it.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

type NavIconName = 'home' | 'map' | 'book' | 'reader'

function NavIcon({ name }: { name: NavIconName }) {
  const paths: Record<NavIconName, ReactNode> = {
    home: <path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z" />,
    map: <><path d="M4 6.5 9 4l6 2.5 5-2.5v13.5L15 20l-6-2.5L4 20z" /><path d="M9 4v13.5" /><path d="M15 6.5V20" /></>,
    book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3-3z" /><path d="M5 4v13" /><path d="M8 7h7" /><path d="M8 10h6" /></>,
    reader: <><path d="M6 4h12a2 2 0 0 1 2 2v14H8a4 4 0 0 0-4-4V6a2 2 0 0 1 2-2z" /><path d="M8 8h8" /><path d="M8 12h6" /></>,
  }
  return (
    <svg className="bottom-nav-icon nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
// Human label for a client route, used in the admin activity feed.
function labelForPath(path: string): string {
  if (path === '/dashboard' || path === '/') return 'Dashboard'
  if (path === '/library') return 'Library'
  if (path === '/alphabet') return 'Alphabet'
  if (path === '/reader') return 'Texts (Reader)'
  if (path.startsWith('/reader/')) return 'Reading text'
  if (path === '/abenteuer') return 'Weeks (Abenteuer)'
  if (path.startsWith('/abenteuer/')) return `Week ${decodeURIComponent(path.slice('/abenteuer/'.length))}`
  if (path.startsWith('/tags/')) return 'Day'
  if (path.startsWith('/sets/')) return `Word set ${decodeURIComponent(path.slice('/sets/'.length))}`
  if (path === '/profile') return 'Own profile'
  if (path.startsWith('/profile/')) return 'A user profile'
  if (path === '/admin/logs') return 'Admin logs'
  return path
}

function ProtectedLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const lastTracked = useRef<string | null>(null)

  // Report each distinct route the signed-in user lands on. Dedup consecutive identical
  // paths so StrictMode double-mounts / re-renders don't double-log.
  useEffect(() => {
    if (!user) return
    const path = location.pathname
    if (lastTracked.current === path) return
    lastTracked.current = path
    api.trackPageView(path, labelForPath(path))
  }, [user, location.pathname])

  if (loading) {
    return <AppShellSkeleton />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="app-shell">
      <LoadingBar />
      <OfflineIndicator />
      <InstallPrompt />
      <PWAUpdatePrompt />
      <TopBar />
      <main className="app-content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Login />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/abenteuer" element={<Abenteuer />} />
            <Route path="/abenteuer/:weekSlug" element={<Abenteuer />} />
            <Route path="/tags/:tagId" element={<TagFlow />} />
            <Route path="/library" element={<Library />} />
            <Route path="/sets/:setSlug" element={<WordSetView />} />
            <Route path="/reader" element={<Reader />} />
            <Route path="/reader/:id" element={<ReaderDetail />} />
            <Route path="/alphabet" element={<Alphabet />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

