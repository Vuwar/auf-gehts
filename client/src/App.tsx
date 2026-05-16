import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import Library from './components/Library'
import WordSetView from './components/WordSetView'
import Dashboard from './components/Dashboard'
import Reader from './components/Reader'
import Profile from './components/Profile'
import Login from './components/Login'
import Abenteuer from './components/Abenteuer'
import { AuthProvider, useAuth } from './auth'
import './App.css'

function TopBar() {
  const { user, profile, signOut } = useAuth()
  const displayLabel = profile?.displayName || user?.email

  return (
    <header className="top-bar">
      <NavLink to="/profile" className="top-bar-profile">
        <span className="top-bar-avatar">{(displayLabel ?? '?')[0]?.toUpperCase()}</span>
        <span className="top-bar-name">{displayLabel}</span>
      </NavLink>
      <nav className="top-bar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `top-bar-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
        <NavLink to="/abenteuer" className={({ isActive }) => `top-bar-link ${isActive ? 'active' : ''}`}>Abenteuer</NavLink>
        <NavLink to="/library" className={({ isActive }) => `top-bar-link ${isActive ? 'active' : ''}`}>Library</NavLink>
        <NavLink to="/reader" className={({ isActive }) => `top-bar-link ${isActive ? 'active' : ''}`}>Reader</NavLink>
      </nav>
      <button onClick={() => signOut()} className="top-bar-signout">Sign out</button>
    </header>
  )
}

function BottomNav() {
  const items: { to: string; label: string; icon: string }[] = [
    { to: '/dashboard', label: 'Home', icon: '🏠' },
    { to: '/abenteuer', label: 'Abenteuer', icon: '🗺️' },
    { to: '/library', label: 'Library', icon: '📚' },
    { to: '/reader', label: 'Reader', icon: '📖' },
  ]
  return (
    <nav className="bottom-nav">
      {items.map(it => (
        <NavLink key={it.to} to={it.to} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">{it.icon}</span>
          <span className="bottom-nav-label">{it.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function ProtectedLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <main><div className="app-content"><p className="empty-state">Loading...</p></div></main>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="app-shell">
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
            <Route path="/library" element={<Library />} />
            <Route path="/sets/:setSlug" element={<WordSetView />} />
            <Route path="/reader" element={<Reader />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
