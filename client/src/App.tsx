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

function ProtectedLayout() {
  const { user, profile, signOut, loading } = useAuth()
  const location = useLocation()
  const displayLabel = profile?.displayName || user?.email

  if (loading) {
    return <main><div className="app-content"><p className="empty-state">Loading...</p></div></main>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <main>
      <nav className="app-nav">
        <div className="app-nav-left">
          <NavLink to="/dashboard" className={({ isActive }) => `app-nav-btn ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
          <NavLink to="/abenteuer" className={({ isActive }) => `app-nav-btn ${isActive ? 'active' : ''}`}>Abenteuer</NavLink>
          <NavLink to="/library" className={({ isActive }) => `app-nav-btn ${isActive ? 'active' : ''}`}>Library</NavLink>
          <NavLink to="/reader" className={({ isActive }) => `app-nav-btn ${isActive ? 'active' : ''}`}>Reader</NavLink>
        </div>
        <div className="app-nav-right">
          <NavLink to="/profile" className={({ isActive }) => `app-nav-btn ${isActive ? 'active' : ''}`}>{displayLabel}</NavLink>
          <button onClick={() => signOut()} className="app-nav-btn">Sign out</button>
        </div>
      </nav>

      <div className="app-content">
        <Outlet />
      </div>
    </main>
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
