import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMarketplace, forkWorkflow } from '../api'
import { useCanvasStore } from '../store/canvasStore'

interface WorkflowSummary {
  id: string
  name: string
  created_at: string
}

export default function MarketplacePage() {
  const { user, signOut } = useCanvasStore()
  const navigate = useNavigate()
  const [agents, setAgents] = useState<WorkflowSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [forking, setForking] = useState<string | null>(null)
  const [forked, setForked] = useState<Set<string>>(new Set())

  useEffect(() => {
    getMarketplace()
      .then(setAgents)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleFork = async (id: string) => {
    setForking(id)
    try {
      await forkWorkflow(id)
      setForked(prev => new Set(prev).add(id))
    } catch (err) {
      alert('Fork failed: ' + String(err))
    } finally {
      setForking(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#f9fafb' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', background: '#1a1a2e', borderBottom: '1px solid #2a2a4a' }}>
        <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 20, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>Agentra</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/dashboard')}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2a2a4a', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>
            ← My Workflows
          </button>
          <span style={{ color: '#6b7280', fontSize: 13 }}>{user?.email}</span>
          <button onClick={signOut}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2a2a4a', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>🏪 Marketplace</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Discover and fork agents built by the community</p>
        </div>

        {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}

        {!loading && agents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', border: '1px dashed #2a2a4a', borderRadius: 12 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
            <p style={{ color: '#6b7280', marginBottom: 8 }}>No public agents yet.</p>
            <p style={{ color: '#4a4a6a', fontSize: 13 }}>Publish one from your dashboard to be the first!</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {agents.map(agent => (
            <div key={agent.id}
              style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{agent.name}</div>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>
                {new Date(agent.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <button
                onClick={() => handleFork(agent.id)}
                disabled={forking === agent.id || forked.has(agent.id)}
                style={{
                  width: '100%', padding: '7px 0', borderRadius: 6, border: 'none', cursor: forked.has(agent.id) ? 'default' : 'pointer',
                  background: forked.has(agent.id) ? '#059669' : '#7c3aed',
                  color: '#fff', fontSize: 13, fontWeight: 600,
                }}>
                {forking === agent.id ? 'Forking…' : forked.has(agent.id) ? '✓ Forked' : '⑂ Fork'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}