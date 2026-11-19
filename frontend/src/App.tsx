import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useCanvasStore } from './store/canvasStore'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import CanvasPage from './pages/CanvasPage'
import MarketplacePage from './pages/MarketplacePage'

const Icons = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  canvas: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><line x1="8.5" y1="6" x2="15.5" y2="6"/><line x1="7.2" y1="8" x2="10.8" y2="16"/><line x1="16.8" y1="8" x2="13.2" y2="16"/></svg>,
  marketplace: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
}

function NavItem({ icon, label, path, active, onClick }: {
  icon: React.ReactNode; label: string; path?: string; active: boolean; onClick?: () => void
}) {
  const navigate = useNavigate()
  return (
    <button
      onClick={onClick ?? (() => path && navigate(path))}
      style={{
        width: '100%', height: 40, borderRadius: 8, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
        background: active ? '#7c3aed22' : 'transparent',
        color: active ? '#c4b5fd' : '#4b5563',
        transition: 'color 0.15s, background 0.15s',
        textAlign: 'left',
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{label}</span>
    </button>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { user, signOut } = useCanvasStore()
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a14', overflow: 'hidden' }}>
      {/* Expanded nav */}
      <div style={{
        width: 220, minWidth: 220, background: '#0c0c1e',
        borderRight: '1px solid #17172e',
        display: 'flex', flexDirection: 'column',
        padding: '12px 8px', flexShrink: 0, zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px', marginBottom: 20 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>A</span>
          </div>
          <span style={{ color: '#f9fafb', fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>Agentra</span>
        </div>

        <NavItem icon={Icons.home} label="Dashboard" path="/dashboard" active={location.pathname === '/dashboard'} />
        <NavItem icon={Icons.canvas} label="Canvas" path="/canvas" active={location.pathname === '/canvas'} />
        <NavItem icon={Icons.marketplace} label="Marketplace" path="/marketplace" active={location.pathname === '/marketplace'} />

        <div style={{ flex: 1 }} />

        <NavItem icon={Icons.settings} label="Settings" active={false} onClick={() => {}} />

        {/* User row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', marginTop: 4, borderTop: '1px solid #17172e',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: '#1e1e3a', border: '1.5px solid #2a2a4a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#a78bfa', fontSize: 11, fontWeight: 700,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#9ca3af', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: 4, display: 'flex', flexShrink: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

function App() {
  const { user, setUser } = useCanvasStore()
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser({ id: session.user.id, email: session.user.email })
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
    })
    return () => subscription.unsubscribe()
  }, [setUser])

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a14', color: '#a78bfa', fontSize: 14 }}>
        Loading…
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/dashboard" element={user ? <Layout><DashboardPage /></Layout> : <Navigate to="/" replace />} />
      <Route path="/canvas" element={user ? <Layout><CanvasPage /></Layout> : <Navigate to="/" replace />} />
      <Route path="/marketplace" element={user ? <Layout><MarketplacePage /></Layout> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App