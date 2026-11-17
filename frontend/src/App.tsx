import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useCanvasStore } from './store/canvasStore'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import CanvasPage from './pages/CanvasPage'
import MarketplacePage from './pages/MarketplacePage'

function App() {
  const { user, setUser } = useCanvasStore()
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
      }
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0f1a', color: '#a78bfa' }}>
        Loading…
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/" replace />} />
      <Route path="/canvas" element={user ? <CanvasPage /> : <Navigate to="/" replace />} />
      <Route path="/marketplace" element={user ? <MarketplacePage /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App