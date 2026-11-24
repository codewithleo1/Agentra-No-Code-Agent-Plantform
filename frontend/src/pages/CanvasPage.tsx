import { useEffect, useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  reconnectEdge,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useNavigate, useLocation } from 'react-router-dom'
import CustomNode, { ConditionNode } from '../components/CustomNode'
import ConfigPanel from '../components/ConfigPanel'
import { useCanvasStore, NODE_COLORS } from '../store/canvasStore'
import type { NodeType } from '../store/canvasStore'
import { supabase } from '../lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const NODE_TYPES = {
  customNode:    CustomNode,
  conditionNode: ConditionNode,
}

const PALETTE: { type: NodeType; label: string; icon: string; desc: string }[] = [
  { type: 'trigger',   label: 'Trigger',       icon: '⚡', desc: 'Manual start'       },
  { type: 'webhook',   label: 'Webhook',        icon: '🪝', desc: 'HTTP trigger'       },
  { type: 'schedule',  label: 'Schedule',       icon: '🕐', desc: 'Cron / interval'    },
  { type: 'llm_call',  label: 'LLM Call',       icon: '🧠', desc: 'AI generation'      },
  { type: 'condition', label: 'Condition',      icon: '⚖️', desc: 'If / else branch'   },
  { type: 'tool',      label: 'Web Search',     icon: '🔍', desc: 'Search (Tavily)'    },
  { type: 'http',      label: 'HTTP Request',   icon: '🌐', desc: 'Call any REST API'  },
  { type: 'transform', label: 'Transform',      icon: '🔄', desc: 'Map / filter data'  },
  { type: 'memory',    label: 'Memory',         icon: '💾', desc: 'Read / write store' },
  { type: 'email',     label: 'Send Email',     icon: '✉️', desc: 'Send via Resend'    },
  { type: 'telegram',  label: 'Telegram',       icon: '✈️', desc: 'Send message'       },
  { type: 'slack',     label: 'Slack',           icon: '💬', desc: 'Post to channel'    },
  { type: 'sheets',    label: 'Google Sheets',  icon: '📊', desc: 'Read / write rows'  },
  { type: 'output',    label: 'Output',         icon: '📤', desc: 'Final response'     },
  { type: 'whatsapp', label: 'WhatsApp', icon: '📱', desc: 'Send message' },
  { type: 'sms', label: 'Send SMS', icon: '📲', desc: 'Send SMS via Twilio' },
  { type: 'slack', label: 'Slack', icon: '💬', desc: 'Post to channel' },
  { type: 'loop', label: 'Loop', icon: '🔁', desc: 'Iterate over a list' },
  { type: 'gmail', label: 'Gmail', icon: '📧', desc: 'Send via Gmail' },
  { type: 'youtube', label: 'YouTube', icon: '▶️', desc: 'Fetch transcript' },
  { type: 'pdf_reader', label: 'PDF Reader', icon: '📄', desc: 'Extract text from PDF' },
]

// Inject once: hide sidebar scrollbar + edge label style
if (typeof document !== 'undefined' && !document.getElementById('agentra-canvas-styles')) {
  const el = document.createElement('style')
  el.id = 'agentra-canvas-styles'
  el.textContent = `
    #agentra-palette::-webkit-scrollbar { display: none; }
    #agentra-palette { scrollbar-width: none; -ms-overflow-style: none; }
    .react-flow__edge-textbg { fill: #0c0c1e !important; }
    .react-flow__edge-text  { fill: #9ca3af !important; font-size: 11px !important; }
    .react-flow__controls { background: #0d0d20 !important; border: 1px solid #7c3aed !important; border-radius: 10px !important; box-shadow: 0 0 12px #7c3aed44 !important; overflow: hidden; }
    .react-flow__controls-button { background: #0d0d20 !important; border-bottom: 1px solid #1e1b4b !important; color: #a78bfa !important; }
    .react-flow__controls-button:hover { background: #1e1b4b !important; }
    .react-flow__controls-button svg { fill: #a78bfa !important; }
  `
  document.head.appendChild(el)
}

export default function CanvasPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // Store — read
  const nodes          = useCanvasStore((s) => s.nodes)
  const edges          = useCanvasStore((s) => s.edges)
  const selectedNode   = useCanvasStore((s) => s.selectedNode)
  const history        = useCanvasStore((s) => s.history)
  const future         = useCanvasStore((s) => s.future)

  // Store — write
  const setNodes         = useCanvasStore((s) => s.setNodes)
  const setEdges         = useCanvasStore((s) => s.setEdges)
  const onNodesChange    = useCanvasStore((s) => s.onNodesChange)
  const onEdgesChange    = useCanvasStore((s) => s.onEdgesChange)
  const onConnect        = useCanvasStore((s) => s.onConnect)
  const setSelectedNode  = useCanvasStore((s) => s.setSelectedNode)
  const addNodeToStore   = useCanvasStore((s) => s.addNode)
  const updateNodeLabel  = useCanvasStore((s) => s.updateNodeLabel)
  const deleteNode       = useCanvasStore((s) => s.deleteNode)
  const clearCanvas      = useCanvasStore((s) => s.clearCanvas)
  const undo             = useCanvasStore((s) => s.undo)
  const redo             = useCanvasStore((s) => s.redo)

  // Local UI state
  const [workflowName, setWorkflowName] = useState<string>(
    (location.state as { workflowName?: string })?.workflowName ?? 'Untitled Workflow'
  )
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [canvasTab,  setCanvasTab]  = useState<'build' | 'preview'>('build')
  const [runStatus,  setRunStatus]  = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [nodeStates, setNodeStates] = useState<Record<string, string>>({})
  const [runOutput,  setRunOutput]  = useState<string>('')
  const [saving,     setSaving]     = useState(false)
  const [runInput,   setRunInput]   = useState('')
  const [runError,   setRunError]   = useState<string | null>(null)

  // Live refs — avoid stale closures in drag/reconnect handlers
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  // ── Keyboard: Ctrl+Z / Ctrl+Y ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault(); redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  // ── Sync nodeStates → data.status ──────────────────────────────────────
  useEffect(() => {
    if (Object.keys(nodeStates).length === 0) return
    setNodes(
      nodes.map((n) => {
        const st = nodeStates[n.id] ?? 'idle'
        const status = st === 'active' ? 'running' : st === 'done' ? 'done' : undefined
        return { ...n, data: { ...n.data, status } }
      })
    )
  }, [nodeStates]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load from DB ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = (location.state as { workflowId?: string })?.workflowId
    if (!id) return
    setWorkflowId(id)
    supabase
      .from('workflows')
      .select('name, nodes, edges')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return
        setWorkflowName(data.name)
        setNodes(
          (data.nodes ?? []).map((n: Node) => ({
            ...n,
            type: n.data?.nodeType === 'condition' ? 'conditionNode' : 'customNode',
          }))
        )
        setEdges(data.edges ?? [])
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/auth'); return }

    const payload = {
      name: workflowName,
      nodes: nodesRef.current,
      edges: edgesRef.current,
      owner_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (workflowId) {
      await supabase.from('workflows').update(payload).eq('id', workflowId)
    } else {
      const { data } = await supabase
        .from('workflows').insert(payload).select('id').single()
      if (data) {
        setWorkflowId(data.id)
        localStorage.setItem('last_workflow_id', data.id)
      }
    }
    setSaving(false)
  }, [workflowId, workflowName, navigate])

  // ── Run ─────────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    setRunStatus('running')
    setRunError(null)
    setNodeStates({})
    setRunOutput('')
    setCanvasTab('build')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''

    const payload = {
      input: runInput,
      nodes: nodesRef.current.map((n) => ({
        id: n.id, type: n.data.nodeType, config: n.data.config,
      })),
      edges: edgesRef.current.map((e) => ({
        source: e.source, target: e.target, sourceHandle: e.sourceHandle,
      })),
    }

    const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    try {
      const res = await fetch(`${BASE}/runs/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok || !res.body) {
        setRunStatus('error')
        setRunError(`Server error: ${res.status} ${res.statusText}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.replace(/^data:\s*/, '')
          if (!line) continue
          try {
            const msg = JSON.parse(line)
            if      (msg.type === 'node_start') setNodeStates((p) => ({ ...p, [msg.node_id]: 'active' }))
            else if (msg.type === 'node_done')  setNodeStates((p) => ({ ...p, [msg.node_id]: 'done' }))
            else if (msg.type === 'output')     setRunOutput((p) => p + msg.content)
            else if (msg.type === 'done')       { setRunStatus('done'); setCanvasTab('preview') }
            else if (msg.type === 'error')      { setRunStatus('error'); setRunOutput(msg.message ?? 'Error') }
          } catch { /* non-JSON frame */ }
        }
      }
      if (runStatus === 'running') setRunStatus('done')
    } catch {
      setRunStatus('error')
      setRunError('Cannot reach backend at ' + BASE + '. Is the server running?')
    }
  }, [runInput])

  // ── UX 1: Insert node between two connected nodes ──────────────────────
  const onNodeDragStop = useCallback((_: React.MouseEvent, draggedNode: Node) => {
    const curEdges = edgesRef.current
    const curNodes = nodesRef.current

    const matched = curEdges.find((e) => {
      if (e.source === draggedNode.id || e.target === draggedNode.id) return false
      const src = curNodes.find((n) => n.id === e.source)
      const tgt = curNodes.find((n) => n.id === e.target)
      if (!src || !tgt) return false
      const minX = Math.min(src.position.x, tgt.position.x)
      const maxX = Math.max(src.position.x, tgt.position.x)
      const midY = (src.position.y + tgt.position.y) / 2
      return (
        draggedNode.position.x > minX + 50 &&
        draggedNode.position.x < maxX - 50 &&
        Math.abs(draggedNode.position.y - midY) < 90
      )
    })

    if (matched) {
      const ts = Date.now()
      setEdges((eds) => [
        ...eds.filter((e) => e.id !== matched.id),
        { id: `e-${matched.source}-${draggedNode.id}-${ts}`,     source: matched.source,  target: draggedNode.id,  animated: true, style: { stroke: '#7c3aed', strokeWidth: 2 } },
        { id: `e-${draggedNode.id}-${matched.target}-${ts + 1}`, source: draggedNode.id,  target: matched.target,  animated: true, style: { stroke: '#7c3aed', strokeWidth: 2 } },
      ])
    }
  }, [])

  // ── UX 2: Reconnect edge endpoint ─────────────────────────────────────
  const handleReconnect = useCallback((oldEdge: Edge, newConn: Connection) => {
    setEdges((eds) => reconnectEdge(oldEdge, newConn, eds))
  }, [])

  // ── UX 6: Double-click node → rename ──────────────────────────────────
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    const label = window.prompt('Rename node:', node.data.label as string)
    if (label !== null && label.trim()) updateNodeLabel(node.id, label.trim())
  }, [updateNodeLabel])

  // ── UX 7: Double-click edge → label ───────────────────────────────────
  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const label = window.prompt('Edge label (empty to remove):', (edge.label as string) ?? '')
    if (label !== null) {
      setEdges((eds) =>
        eds.map((e) => e.id === edge.id ? { ...e, label: label.trim() || undefined } : e)
      )
    }
  }, [])

  // ── UX 3: Clear canvas ────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    if (window.confirm('Clear the entire canvas? (Undo with Ctrl+Z)')) clearCanvas()
  }, [clearCanvas])

  // ── Shared button style ───────────────────────────────────────────────
  const btn = (active?: boolean, danger?: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
    background: danger ? '#7f1d1d' : active ? '#7c3aed' : '#1e1b4b',
    color: danger ? '#fca5a5' : '#e5e7eb',
    fontSize: 12, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 4,
  })

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0c0c1e', color: '#e5e7eb' }}>

      {/* ── Toolbar ── */}
      <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: '1px solid #1e1b4b', background: '#0d0d20' }}>
        <button onClick={() => navigate('/')} style={{ ...btn(), padding: '5px 8px', fontSize: 18 }}>←</button>

        <input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: 14, fontWeight: 600, width: 200 }}
        />

        <div style={{ flex: 1 }} />

        <button onClick={undo} disabled={history.length === 0} title="Undo (Ctrl+Z)"
          style={{ ...btn(), opacity: history.length === 0 ? 0.4 : 1 }}>↩</button>
        <button onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Y)"
          style={{ ...btn(), opacity: future.length === 0 ? 0.4 : 1 }}>↪</button>

        <button onClick={handleClear} style={btn(false, true)} title="Clear canvas">🗑 Clear</button>
        <button onClick={handleSave} style={btn()} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</button>

        <button onClick={handleRun} style={btn(true)} disabled={runStatus === 'running'}>
          {runStatus === 'running' ? '⏳ Running…' : '▶ Run'}
        </button>
      </div>

      {/* ── Trigger input bar (always visible) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', background: '#0d0d20', borderBottom: '1px solid #1e1b4b' }}>
        <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          Trigger Input
        </span>
        <input
          value={runInput}
          onChange={(e) => { setRunInput(e.target.value); setRunError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun() } }}
          placeholder="Type your agent input… (Enter to run)"
          style={{
            flex: 1, padding: '5px 12px', borderRadius: 6,
            border: `1px solid ${runError ? '#7f1d1d' : '#1e1b4b'}`, background: '#06060f',
            color: '#e5e7eb', fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
        />
        {runError && (
          <span style={{ fontSize: 11, color: '#ef4444', whiteSpace: 'nowrap', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }} title={runError}>
            ✗ {runError}
          </span>
        )}
      </div>

      {/* ── Main area ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Node palette ── */}
        <div id="agentra-palette" style={{ width: 190, background: '#0d0d20', borderRight: '1px solid #1e1b4b', overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, letterSpacing: 1, padding: '0 4px 8px', textTransform: 'uppercase' }}>
            Add Node
          </div>

          {PALETTE.map(({ type, label, icon, desc }) => {
            const color = NODE_COLORS[type] ?? '#7c3aed'
            return (
              <button
                key={label}
                onClick={() => addNodeToStore(type, label)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: '#131329', border: `1px solid ${color}33`, color: '#e5e7eb', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = color + '22')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#131329')}
              >
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: color + '22', border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                  {icon}
                </span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{desc}</div>
                </div>
              </button>
            )
          })}

          <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: '#1e1b4b22', fontSize: 10, color: '#6b7280', lineHeight: 1.5 }}>
            💡 Drag a node onto an edge to insert it in-between<br /><br />
            ✏️ Double-click a node to rename it
          </div>
        </div>

        {/* ── Canvas ── */}
        <div style={{ flex: 1, position: 'relative' }}>

          {/* Build / Preview tabs */}
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: 2, background: '#0d0d20', border: '1px solid #1e1b4b', borderRadius: 8, padding: 3 }}>
            {(['build', 'preview'] as const).map((tab) => (
              <button key={tab} onClick={() => setCanvasTab(tab)} style={{ padding: '4px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: canvasTab === tab ? '#7c3aed' : 'transparent', color: canvasTab === tab ? '#fff' : '#6b7280', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                {tab}
              </button>
            ))}
          </div>

          {/* Build canvas */}
          {canvasTab === 'build' && (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNode(node)}
              onPaneClick={() => setSelectedNode(null)}
              onNodeDoubleClick={onNodeDoubleClick}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onNodeDragStop={onNodeDragStop}
              onReconnect={handleReconnect}
              fitView
              deleteKeyCode="Delete"
              style={{ background: '#0c0c1e' }}
              defaultEdgeOptions={{ animated: true, style: { stroke: '#7c3aed', strokeWidth: 2 } }}
            >
              <Background color="#1e1b4b" gap={20} />
              <Controls style={{}} />
              <MiniMap
                style={{ background: '#0d0d20', border: '1px solid #1e1b4b' }}
                nodeColor={(n) => (n.data?.baseColor as string) ?? '#7c3aed'}
                maskColor="#0c0c1e88"
              />
            </ReactFlow>
          )}

          {/* Preview / output */}
          {canvasTab === 'preview' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
              {runStatus === 'idle' && (
                <div style={{ color: '#6b7280', textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>▶</div>
                  <div>Hit <strong>Run</strong> to execute the workflow</div>
                </div>
              )}
              {runStatus === 'running' && (
                <div style={{ color: '#eab308', fontSize: 14 }}>⏳ Running…</div>
              )}
              {(runStatus === 'done' || runStatus === 'error') && (
                <div style={{ width: '100%', maxWidth: 640, background: '#0d0d20', border: '1px solid #1e1b4b', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: runStatus === 'error' ? '#ef4444' : '#22c55e', marginBottom: 12, textTransform: 'uppercase' }}>
                    {runStatus === 'error' ? '✗ Error' : '✓ Output'}
                  </div>
                  <div style={{ maxHeight: 400, overflowY: 'auto', color: '#e5e7eb', fontSize: 13, lineHeight: 1.7 }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({children}) => <h1 style={{fontSize:18, fontWeight:700, marginBottom:8, color:'#a78bfa'}}>{children}</h1>,
                        h2: ({children}) => <h2 style={{fontSize:15, fontWeight:700, marginBottom:6, color:'#a78bfa'}}>{children}</h2>,
                        h3: ({children}) => <h3 style={{fontSize:13, fontWeight:700, marginBottom:4, color:'#c4b5fd'}}>{children}</h3>,
                        p:  ({children}) => <p  style={{marginBottom:8}}>{children}</p>,
                        strong: ({children}) => <strong style={{color:'#f9fafb', fontWeight:700}}>{children}</strong>,
                        table: ({children}) => <table style={{width:'100%', borderCollapse:'collapse', marginBottom:12}}>{children}</table>,
                        th: ({children}) => <th style={{padding:'6px 8px', background:'#1e1b4b', borderBottom:'1px solid #374151', textAlign:'left', fontSize:11, fontWeight:700, color:'#9ca3af'}}>{children}</th>,
                        td: ({children}) => <td style={{padding:'6px 8px', borderBottom:'1px solid #1e1b4b', fontSize:12}}>{children}</td>,
                        li: ({children}) => <li style={{marginBottom:4}}>{children}</li>,
                        ul: ({children}) => <ul style={{paddingLeft:20, marginBottom:8}}>{children}</ul>,
                        ol: ({children}) => <ol style={{paddingLeft:20, marginBottom:8}}>{children}</ol>,
                        code: ({children}) => <code style={{background:'#1e1b4b', padding:'2px 6px', borderRadius:4, fontSize:12, color:'#c4b5fd'}}>{children}</code>,
                      }}
                    >
                      {runOutput || '*(no output)*'}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Config panel — reads store directly, no props needed ── */}
        {selectedNode && <ConfigPanel />}
      </div>
    </div>
  )
}