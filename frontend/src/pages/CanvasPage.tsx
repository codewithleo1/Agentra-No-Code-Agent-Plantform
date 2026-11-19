import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import type { NodeMouseHandler, OnConnect, OnEdgesChange, OnNodesChange } from '@xyflow/react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NodeType } from '../store/canvasStore'
import { useCanvasStore, NODE_COLORS } from '../store/canvasStore'
import ConfigPanel from '../components/ConfigPanel'
import NodePalette from '../components/NodePalette'
import ConditionNode from '../components/ConditionNode'
import { createWorkflow, updateWorkflow, getWorkflow, streamRun } from '../api'

const NODE_TYPES = { conditionNode: ConditionNode }

type RunStatus = 'idle' | 'running' | 'done' | 'error'
type NodeState = 'idle' | 'active' | 'done'

function getNodeStyle(baseColor: string, nState: NodeState, isSelected: boolean) {
  const bg = nState === 'active' ? '#facc15' : nState === 'done' ? '#34d399' : baseColor
  return {
    background: bg, color: '#fff', borderRadius: 8,
    border: isSelected ? '2px solid #f9fafb' : '2px solid transparent',
    boxShadow: nState === 'active' ? '0 0 24px 8px #facc15' : nState === 'done' ? '0 0 16px 4px #34d399' : isSelected ? '0 0 0 3px #7c3aed' : 'none',
    transition: 'all 0.3s ease',
  }
}

export default function CanvasPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { nodes, edges, setNodes, setEdges, selectedNode, setSelectedNode, deleteNode, user, signOut } = useCanvasStore()

  const [status, setStatus] = useState<RunStatus>('idle')
  const [output, setOutput] = useState<string>('')
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({})
  const [inputText, setInputText] = useState<string>('')
  const [deployInfo, setDeployInfo] = useState<{ api_key: string; endpoint: string; curl_example: string; widget_snippet: string } | null>(null)
  const [showDeploy, setShowDeploy] = useState(false)
  const [deployTab, setDeployTab] = useState<'curl' | 'widget'>('curl')

  // Auto-save state
  const [workflowId, setWorkflowId] = useState<string | null>(searchParams.get('id'))
  const [workflowName, setWorkflowName] = useState<string>(
    (location.state as { workflowName?: string })?.workflowName ?? 'My Workflow'
  )

  // Debug panel
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, string>>({})
  const [showDebug, setShowDebug] = useState(false)
  const [debugNodeId, setDebugNodeId] = useState<string | null>(null)
  const currentNodeRef = useRef<string | null>(null)

  // Load workflow from URL ?id=
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return
    getWorkflow(id).then(wf => {
      setWorkflowName(wf.name)
      setNodes(wf.nodes.map(n => ({
        id: n.id,
        type: (n.data?.nodeType === 'condition') ? 'conditionNode' : 'default',
        position: n.position,
        data: n.data,
        style: getNodeStyle(
          (n.data?.baseColor as string) ?? NODE_COLORS[n.data?.nodeType as NodeType] ?? '#4f46e5',
          'idle', false
        ),
      })))
      setEdges(wf.edges.map(e => ({
        id: e.id, source: e.source, target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
      })))
    }).catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Node style sync
  useEffect(() => {
    setNodes(nodes.map((n) => {
      if (n.type === 'conditionNode') return n
      const baseColor = (n.data.baseColor as string) ?? NODE_COLORS[(n.data.nodeType as NodeType)] ?? '#4f46e5'
      const nState = nodeStates[n.id] ?? 'idle'
      const isSelected = selectedNode?.id === n.id
      return { ...n, style: getNodeStyle(baseColor, nState, isSelected) }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeStates, selectedNode])

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes(applyNodeChanges(changes, nodes)), [nodes, setNodes])
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges(applyEdgeChanges(changes, edges)), [edges, setEdges])
  const onConnect: OnConnect = useCallback((connection) => setEdges(addEdge({ ...connection, id: `e_${Date.now()}` }, edges)), [edges, setEdges])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode({ id: node.id, type: node.data.nodeType as NodeType, label: String(node.data.label), config: (node.data.config as Record<string, unknown>) ?? {} })
    // Show debug panel if this node has output from last run
    if (nodeOutputs[node.id]) {
      setDebugNodeId(node.id)
      setShowDebug(true)
    }
  }, [setSelectedNode, nodeOutputs])

  // Duplicate node
  const handleDuplicate = useCallback(() => {
    if (!selectedNode) return
    const original = nodes.find(n => n.id === selectedNode.id)
    if (!original) return
    const newId = `node_${Date.now()}`
    setNodes([...nodes, {
      ...original,
      id: newId,
      position: { x: original.position.x + 50, y: original.position.y + 50 },
      selected: false,
    }])
  }, [selectedNode, nodes, setNodes])

  // Keyboard shortcuts: Delete to remove, Ctrl+D to duplicate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode) deleteNode(selectedNode.id)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        handleDuplicate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNode, deleteNode, handleDuplicate])

  const setNodeState = useCallback((nodeId: string, state: NodeState) => {
    setNodeStates((prev) => ({ ...prev, [nodeId]: state }))
  }, [])

  const handleRun = async () => {
    if (!inputText.trim()) return
    if (nodes.length === 0) { setOutput('Add some nodes first.'); setStatus('error'); return }
    setStatus('running'); setOutput('')
    setNodeOutputs({})
    currentNodeRef.current = null
    const resetStates: Record<string, NodeState> = {}
    nodes.forEach((n) => { resetStates[n.id] = 'idle' })
    setNodeStates(resetStates)

    const workflowData = {
      name: workflowName,
      nodes: nodes.map((n) => ({ id: n.id, type: 'node', position: n.position, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
    }

    try {
      let wf
      if (workflowId) {
        // Update existing — no duplicate created
        wf = await updateWorkflow(workflowId, workflowData)
      } else {
        // First run — create new
        wf = await createWorkflow(workflowData)
        setWorkflowId(wf.id)
      }

      await streamRun(
        wf.id,
        inputText.trim(),
        (token) => {
          setOutput((prev) => prev + token)
          // Accumulate per-node output for debug panel
          if (currentNodeRef.current) {
            const nid = currentNodeRef.current
            setNodeOutputs(prev => ({ ...prev, [nid]: (prev[nid] ?? '') + token }))
          }
        },
        () => setStatus('done'),
        (nodeId, state) => {
          setNodeState(nodeId, state)
          if (state === 'active') currentNodeRef.current = nodeId
        },
      )
    } catch (err) { setOutput(String(err)); setStatus('error') }
  }

  const handleDeploy = async () => {
    if (nodes.length === 0) return
    try {
      const wf = await createWorkflow({
        name: 'Deployed Agent',
        nodes: nodes.map((n) => ({ id: n.id, type: 'node', position: n.position, data: n.data })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
      })
      const res = await fetch(`http://localhost:8000/deploy/${wf.id}`, { method: 'POST' })
      const data = await res.json()
      setDeployInfo(data)
      setDeployTab('curl')
      setShowDeploy(true)
    } catch (err) { alert('Deploy failed: ' + String(err)) }
  }

  // Find node label for debug panel header
  const debugNode = debugNodeId ? nodes.find(n => n.id === debugNodeId) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f1a' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: '#1a1a2e', borderBottom: '1px solid #2a2a4a' }}>
        <span onClick={() => navigate('/dashboard')} style={{ color: '#a78bfa', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>Agentra</span>
        <span style={{ color: '#3a3a5a', fontSize: 13 }}>·</span>
        <span style={{ color: '#6b7280', fontSize: 13, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workflowName}</span>
        {workflowId && <span style={{ fontSize: 11, color: '#34d399', background: '#34d39920', padding: '2px 8px', borderRadius: 20 }}>Saved</span>}
        <input
          type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && status !== 'running' && handleRun()}
          placeholder="Paste a URL or ask anything…" disabled={status === 'running'}
          style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: '1px solid #2a2a4a', background: '#0f0f1a', color: '#f9fafb', fontSize: 14, outline: 'none' }}
        />
        {selectedNode && (
          <button onClick={handleDuplicate} title="Duplicate node (Ctrl+D)"
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #2a2a4a', cursor: 'pointer', background: 'transparent', color: '#a78bfa', fontSize: 13 }}>
            ⊕ Dupe
          </button>
        )}
        <button onClick={handleDeploy} disabled={nodes.length === 0}
          style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#0891b2', color: '#fff', fontWeight: 600, fontSize: 14 }}>
          🚀 Deploy
        </button>
        <button onClick={handleRun} disabled={status === 'running' || !inputText.trim()}
          style={{ padding: '6px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', background: status === 'running' ? '#4a4a6a' : '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 14 }}>
          {status === 'running' ? 'Running…' : '▶ Run'}
        </button>
        <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>{user?.email}</span>
        <button onClick={signOut}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #2a2a4a', cursor: 'pointer', background: 'transparent', color: '#9ca3af', fontSize: 12 }}>
          Sign out
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NodePalette />
        <div style={{ flex: 1, position: 'relative' }}>
          {nodes.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a3a5a', fontSize: 15, pointerEvents: 'none', zIndex: 10 }}>
              ← Add nodes from the sidebar to build your agent
            </div>
          )}
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={onNodeClick} onPaneClick={() => { setSelectedNode(null); setShowDebug(false) }}
            fitView deleteKeyCode={null}
          >
            <Background color="#2a2a4a" />
            <Controls />
            <MiniMap
              nodeColor={(n) => (n.data?.baseColor as string) ?? '#4f46e5'}
              maskColor="#0f0f1a99"
              style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8 }}
            />
          </ReactFlow>

          {/* Debug panel — appears bottom-left after a run when you click a node */}
          {showDebug && debugNode && debugNodeId && nodeOutputs[debugNodeId] && (
            <div style={{
              position: 'absolute', bottom: 16, left: 16, width: 320, maxHeight: 240,
              background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 10,
              zIndex: 20, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 24px #00000066',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2a2a4a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, background: '#7c3aed33', color: '#a78bfa', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                    {String(debugNode.data?.nodeType ?? 'node')}
                  </span>
                  <span style={{ color: '#f9fafb', fontSize: 13, fontWeight: 600 }}>{String(debugNode.data?.label ?? '')}</span>
                </div>
                <button onClick={() => setShowDebug(false)}
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '10px 14px', overflowY: 'auto', flex: 1 }}>
                <div style={{ color: '#5a5a7a', fontSize: 11, marginBottom: 6, letterSpacing: '.04em' }}>OUTPUT</div>
                <pre style={{ margin: 0, color: '#34d399', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {nodeOutputs[debugNodeId]}
                </pre>
              </div>
            </div>
          )}
        </div>
        {selectedNode && <ConfigPanel />}
      </div>

      {/* Output bar */}
      {status !== 'idle' && (
        <div style={{ padding: '12px 20px', background: '#1a1a2e', borderTop: '1px solid #2a2a4a', minHeight: 60, maxHeight: 160, overflowY: 'auto' }}>
          <span style={{ color: '#6b7280', fontSize: 12, marginRight: 8 }}>OUTPUT</span>
          {status === 'running' && !output && <span style={{ color: '#a78bfa' }}>Running…</span>}
          {output && <span style={{ color: status === 'error' ? '#f87171' : '#34d399' }}>{output}</span>}
          {status === 'done' && Object.keys(nodeOutputs).length > 0 && (
            <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 12 }}>· Click any green node to inspect its output</span>
          )}
        </div>
      )}

      {/* Deploy modal */}
      {showDeploy && deployInfo && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000cc', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 28, maxWidth: 600, width: '90%' }}>
            <div style={{ color: '#34d399', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🚀 Agent Deployed!</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>ENDPOINT</div>
              <code style={{ color: '#a78bfa', fontSize: 13 }}>{deployInfo.endpoint}</code>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>API KEY</div>
              <code style={{ color: '#fbbf24', fontSize: 12, wordBreak: 'break-all' }}>{deployInfo.api_key}</code>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['curl', 'widget'] as const).map(tab => (
                <button key={tab} onClick={() => setDeployTab(tab)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: deployTab === tab ? '#7c3aed' : '#2a2a4a',
                  color: deployTab === tab ? '#fff' : '#9ca3af', fontSize: 12, fontWeight: 600,
                }}>{tab === 'curl' ? '⚡ cURL' : '🧩 Widget'}</button>
              ))}
            </div>
            {deployTab === 'curl' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>CURL EXAMPLE</div>
                <pre style={{ background: '#0f0f1a', borderRadius: 6, padding: 12, color: '#f9fafb', fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{deployInfo.curl_example}</pre>
              </div>
            )}
            {deployTab === 'widget' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>EMBED SNIPPET</div>
                <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 8 }}>Drop this in any HTML page to embed your agent as a chat bubble.</div>
                <pre style={{ background: '#0f0f1a', borderRadius: 6, padding: 12, color: '#34d399', fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{deployInfo.widget_snippet}</pre>
                <button onClick={() => navigator.clipboard.writeText(deployInfo!.widget_snippet)}
                  style={{ marginTop: 8, padding: '5px 14px', borderRadius: 6, border: 'none', background: '#2a2a4a', color: '#a78bfa', cursor: 'pointer', fontSize: 12 }}>
                  📋 Copy snippet
                </button>
              </div>
            )}
            <button onClick={() => setShowDeploy(false)}
              style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}