import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCanvasStore } from '../store/canvasStore'
import { getMarketplace, forkWorkflow } from '../api'
import type { WorkflowResponse } from '../api'

// ── Starter templates (frontend-only, no DB needed) ──────────────────────────
const TEMPLATES = [
  {
    id: 'tpl-web-research',
    name: 'Web Research Agent',
    description: 'Search the web and summarize findings with AI',
    emoji: '🔍',
    nodes: [
      { id: 'n1', type: 'default', position: { x: 100, y: 180 }, data: { nodeType: 'trigger', label: 'Trigger', baseColor: '#7c3aed', config: {} } },
      { id: 'n2', type: 'default', position: { x: 320, y: 180 }, data: { nodeType: 'tool', label: 'Web Search', baseColor: '#d97706', config: { tool: 'web_search', query: '' } } },
      { id: 'n3', type: 'default', position: { x: 540, y: 180 }, data: { nodeType: 'llm_call', label: 'Summarize', baseColor: '#0891b2', config: { model: 'llama-3.3-70b-versatile', prompt: 'Summarize these search results clearly: {input}', system_prompt: 'You are a research assistant. Be concise and factual.' } } },
      { id: 'n4', type: 'default', position: { x: 760, y: 180 }, data: { nodeType: 'output', label: 'Output', baseColor: '#059669', config: {} } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },
  {
    id: 'tpl-url-summarizer',
    name: 'URL Summarizer',
    description: 'Paste a URL — get a clean summary back',
    emoji: '📄',
    nodes: [
      { id: 'n1', type: 'default', position: { x: 100, y: 180 }, data: { nodeType: 'trigger', label: 'Trigger', baseColor: '#7c3aed', config: {} } },
      { id: 'n2', type: 'default', position: { x: 320, y: 180 }, data: { nodeType: 'tool', label: 'Read URL', baseColor: '#d97706', config: { tool: 'jina_reader', url: '' } } },
      { id: 'n3', type: 'default', position: { x: 540, y: 180 }, data: { nodeType: 'llm_call', label: 'Summarize', baseColor: '#0891b2', config: { model: 'llama-3.3-70b-versatile', prompt: 'Give a 3-bullet summary of this article: {input}', system_prompt: 'You are a helpful summarizer. Use plain language.' } } },
      { id: 'n4', type: 'default', position: { x: 760, y: 180 }, data: { nodeType: 'output', label: 'Output', baseColor: '#059669', config: {} } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },
  {
    id: 'tpl-email-drafter',
    name: 'Email Drafter',
    description: 'Describe what you need — get a ready-to-send email',
    emoji: '✉️',
    nodes: [
      { id: 'n1', type: 'default', position: { x: 100, y: 180 }, data: { nodeType: 'trigger', label: 'Trigger', baseColor: '#7c3aed', config: {} } },
      { id: 'n2', type: 'default', position: { x: 320, y: 180 }, data: { nodeType: 'llm_call', label: 'Draft Email', baseColor: '#0891b2', config: { model: 'llama-3.3-70b-versatile', prompt: 'Write a professional email for: {input}', system_prompt: 'You write clear, concise professional emails. Include subject line.' } } },
      { id: 'n3', type: 'default', position: { x: 540, y: 180 }, data: { nodeType: 'output', label: 'Output', baseColor: '#059669', config: {} } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ],
  },
  {
    id: 'tpl-classifier',
    name: 'Intent Classifier',
    description: 'Route inputs through true/false conditional logic',
    emoji: '🔀',
    nodes: [
      { id: 'n1', type: 'default', position: { x: 80, y: 200 }, data: { nodeType: 'trigger', label: 'Trigger', baseColor: '#7c3aed', config: {} } },
      { id: 'n2', type: 'default', position: { x: 280, y: 200 }, data: { nodeType: 'llm_call', label: 'Classify', baseColor: '#0891b2', config: { model: 'llama-3.3-70b-versatile', prompt: 'Is this a complaint? Reply only YES or NO: {input}', system_prompt: 'You classify customer messages. Reply only YES or NO.' } } },
      { id: 'n3', type: 'conditionNode', position: { x: 480, y: 200 }, data: { nodeType: 'condition', label: 'Is Complaint?', baseColor: '#be185d', config: { condition: 'YES' } } },
      { id: 'n4', type: 'default', position: { x: 700, y: 120 }, data: { nodeType: 'output', label: 'Handle Complaint', baseColor: '#059669', config: {} } },
      { id: 'n5', type: 'default', position: { x: 700, y: 280 }, data: { nodeType: 'output', label: 'Standard Reply', baseColor: '#059669', config: {} } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true' },
      { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false' },
    ],
  },
  {
    id: 'tpl-telegram-bot',
    name: 'Telegram Bot',
    description: 'Answer any message sent to your Telegram bot with AI',
    emoji: '🤖',
    nodes: [
      { id: 'n1', type: 'default', position: { x: 100, y: 180 }, data: { nodeType: 'trigger', label: 'Trigger', baseColor: '#7c3aed', config: {} } },
      { id: 'n2', type: 'default', position: { x: 320, y: 180 }, data: { nodeType: 'llm_call', label: 'AI Reply', baseColor: '#0891b2', config: { model: 'llama-3.3-70b-versatile', prompt: '{input}', system_prompt: 'You are a helpful Telegram assistant. Keep replies short.' } } },
      { id: 'n3', type: 'default', position: { x: 540, y: 180 }, data: { nodeType: 'telegram', label: 'Send to Telegram', baseColor: '#0088cc', config: { bot_token: '', chat_id: '' } } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ],
  },
  {
    id: 'tpl-sheet-reporter',
    name: 'Sheet Reporter',
    description: 'Read a Google Sheet and generate an AI summary report',
    emoji: '📊',
    nodes: [
      { id: 'n1', type: 'default', position: { x: 100, y: 180 }, data: { nodeType: 'trigger', label: 'Trigger', baseColor: '#7c3aed', config: {} } },
      { id: 'n2', type: 'default', position: { x: 320, y: 180 }, data: { nodeType: 'google_sheets', label: 'Read Sheet', baseColor: '#16a34a', config: { spreadsheet_id: '', range: 'Sheet1!A1:Z100', action: 'read' } } },
      { id: 'n3', type: 'default', position: { x: 540, y: 180 }, data: { nodeType: 'llm_call', label: 'Analyse', baseColor: '#0891b2', config: { model: 'llama-3.3-70b-versatile', prompt: 'Analyse this spreadsheet data and write a brief report: {input}', system_prompt: 'You are a data analyst. Highlight key trends and anomalies.' } } },
      { id: 'n4', type: 'default', position: { x: 760, y: 180 }, data: { nodeType: 'output', label: 'Output', baseColor: '#059669', config: {} } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },
]
// ─────────────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const navigate = useNavigate()
  const { user, signOut, setNodes, setEdges } = useCanvasStore()
  const [community, setCommunity] = useState<WorkflowResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [forked, setForked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    getMarketplace()
      .then(setCommunity)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleUseTemplate = (tpl: typeof TEMPLATES[0]) => {
    setNodes(tpl.nodes as Parameters<typeof setNodes>[0])
    setEdges(tpl.edges)
    navigate('/canvas', { state: { workflowName: tpl.name } })
  }

  const handleFork = async (id: string) => {
    try {
      await forkWorkflow(id)
      setForked(prev => ({ ...prev, [id]: true }))
    } catch (err) { alert('Fork failed: ' + String(err)) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#f9fafb' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', background: '#1a1a2e', borderBottom: '1px solid #2a2a4a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span onClick={() => navigate('/dashboard')} style={{ color: '#a78bfa', fontWeight: 700, fontSize: 20, cursor: 'pointer' }}>Agentra</span>
          <span style={{ color: '#f9fafb', fontWeight: 600, fontSize: 15 }}>Marketplace</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#6b7280', fontSize: 13 }}>{user?.email}</span>
          <button onClick={signOut}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2a2a4a', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>

        {/* ── Starter Templates ─────────────────────────────── */}
        <div style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>🚀 Starter Templates</h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28 }}>One click to open a pre-built agent on the canvas. Configure and run immediately.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {TEMPLATES.map(tpl => (
              <div key={tpl.id}
                style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{tpl.emoji}</div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{tpl.name}</div>
                <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>{tpl.description}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {tpl.nodes.map(n => (
                    <span key={n.id} style={{ fontSize: 11, background: '#2a2a4a', color: '#9ca3af', padding: '2px 8px', borderRadius: 20 }}>
                      {String(n.data.nodeType)}
                    </span>
                  ))}
                </div>
                <button onClick={() => handleUseTemplate(tpl)}
                  style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Use Template →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Community Agents ──────────────────────────────── */}
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>🌍 Community Agents</h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28 }}>Agents published by other Agentra users. Fork to your dashboard and customize.</p>

          {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}

          {!loading && community.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 24px', border: '1px dashed #2a2a4a', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
              <p style={{ color: '#6b7280', marginBottom: 16 }}>No community agents yet.</p>
              <p style={{ color: '#4a4a6a', fontSize: 13 }}>Publish your workflow from the dashboard to be the first!</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {community.map(wf => (
              <div key={wf.id}
                style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{wf.name}</div>
                <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>
                  {new Date(wf.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <button
                  onClick={() => handleFork(wf.id)}
                  disabled={forked[wf.id]}
                  style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', cursor: forked[wf.id] ? 'default' : 'pointer', background: forked[wf.id] ? '#059669' : '#2a2a4a', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                  {forked[wf.id] ? '✓ Forked' : '🍴 Fork'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}