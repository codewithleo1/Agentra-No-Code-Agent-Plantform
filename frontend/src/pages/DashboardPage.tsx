import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCanvasStore } from '../store/canvasStore'
import { getWorkflows, publishWorkflow } from '../api'

interface WorkflowSummary {
  id: string
  name: string
  created_at: string
  is_public?: boolean
}

export default function DashboardPage() {
  const { user, signOut, setNodes, setEdges } = useCanvasStore()
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [publishing, setPublishing] = useState<string | null>(null)

  useEffect(() => {
    getWorkflows()
      .then(setWorkflows)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleNew = () => {
    setNewName('My Workflow')
    setShowNameModal(true)
  }

  const handleCreateConfirm = () => {
    if (!newName.trim()) return
    setNodes([])
    setEdges([])
    navigate('/canvas', { state: { workflowName: newName.trim() } })
    setShowNameModal(false)
  }

  const handleOpen = (id: string) => {
    navigate(`/canvas?id=${id}`)
  }

  const handlePublish = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setPublishing(id)
    try {
      await publishWorkflow(id)
      setWorkflows(prev => prev.map(wf => wf.id === id ? { ...wf, is_public: true } : wf))
    } catch (err) {
      alert('Publish failed: ' + String(err))
    } finally {
      setPublishing(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#f9fafb' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', background: '#1a1a2e', borderBottom: '1px solid #2a2a4a' }}>
        <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 20 }}>Agentra</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/marketplace')}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2a2a4a', background: 'transparent', color: '#a78bfa', cursor: 'pointer', fontSize: 13 }}>
            🏪 Marketplace
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>My Workflows</h1>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Build, run, and deploy your AI agents</p>
          </div>
          <button onClick={handleNew}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            + New Workflow
          </button>
        </div>

        {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}

        {!loading && workflows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', border: '1px dashed #2a2a4a', borderRadius: 12 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>No workflows yet. Build your first agent.</p>
            <button onClick={handleNew}
              style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              + New Workflow
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {workflows.map(wf => (
            <div key={wf.id} onClick={() => handleOpen(wf.id)}
              style={{ background: '#1a1a2e', border: `1px solid ${wf.is_public ? '#7c3aed' : '#2a2a4a'}`, borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s' }}
              onMouseEnter={e => { if (!wf.is_public) e.currentTarget.style.borderColor = '#7c3aed' }}
              onMouseLeave={e => { if (!wf.is_public) e.currentTarget.style.borderColor = '#2a2a4a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 28 }}>⚡</div>
                {wf.is_public
                  ? <span style={{ fontSize: 11, background: '#7c3aed22', color: '#a78bfa', border: '1px solid #7c3aed44', borderRadius: 10, padding: '2px 8px' }}>Public</span>
                  : <button onClick={e => handlePublish(e, wf.id)} disabled={publishing === wf.id}
                      style={{ fontSize: 11, background: 'transparent', color: '#6b7280', border: '1px solid #2a2a4a', borderRadius: 10, padding: '2px 8px', cursor: 'pointer' }}>
                      {publishing === wf.id ? 'Publishing…' : 'Publish'}
                    </button>
                }
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{wf.name}</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>
                {new Date(wf.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showNameModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000cc', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 28, width: 380 }}>
            <h3 style={{ color: '#f9fafb', fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Name your workflow</h3>
            <input autoFocus type="text" value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateConfirm()}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2a4a', background: '#0f0f1a', color: '#f9fafb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNameModal(false)}
                style={{ padding: '7px 18px', borderRadius: 6, border: '1px solid #2a2a4a', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={handleCreateConfirm} disabled={!newName.trim()}
                style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}