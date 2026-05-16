import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import Library from './components/Library'
import WordSetView from './components/WordSetView'
import Dashboard from './components/Dashboard'
import Reader from './components/Reader'
import Profile from './components/Profile'
import Login from './components/Login'
import Abenteuer from './components/Abenteuer'
import { AuthProvider, useAuth } from './auth'
import './App.css'

function Layout() {
  const { user, profile, signOut } = useAuth()
  const displayLabel = profile?.displayName || user?.email

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
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/abenteuer" element={<Abenteuer />} />
          <Route path="/abenteuer/:weekSlug" element={<Abenteuer />} />
          <Route path="/library" element={<Library />} />
          <Route path="/sets/:setSlug" element={<WordSetView />} />
          <Route path="/reader" element={<Reader />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </main>
  )
}

function AppShell() {
  const { user, loading } = useAuth()
  if (loading) return <main><div className="app-content"><p className="empty-state">Loading...</p></div></main>
  if (!user) return <Login />
  return <Layout />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  )
}
