import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import type { NodeMouseHandler, OnConnect, OnEdgesChange, OnNodesChange } from '@xyflow/react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NodeType } from '../store/canvasStore'
import { useCanvasStore, NODE_COLORS } from '../store/canvasStore'
import ConfigPanel from '../components/ConfigPanel'
import NodePalette from '../components/NodePalette'
import CustomNode, { ConditionNode } from '../components/CustomNode'
import { createWorkflow, updateWorkflow, getWorkflow, streamRun } from '../api'

const NODE_TYPES = { customNode: CustomNode, conditionNode: ConditionNode }

type RunStatus = 'idle' | 'running' | 'done' | 'error'
type NodeState = 'idle' | 'active' | 'done'
type CanvasTab = 'build' | 'preview' | 'monitor'

export default function CanvasPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { nodes, edges, setNodes, setEdges, selectedNode, setSelectedNode, deleteNode } = useCanvasStore()

  const [status, setStatus] = useState<RunStatus>('idle')
  const [output, setOutput] = useState<string>('')
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({})
  const [inputText, setInputText] = useState<string>('')
  const [deployInfo, setDeployInfo] = useState<{ api_key: string; endpoint: string; curl_example: string; widget_snippet: string } | null>(null)
  const [showDeploy, setShowDeploy] = useState(false)
  const [deployTab, setDeployTab] = useState<'curl' | 'widget'>('curl')
  const [canvasTab, setCanvasTab] = useState<CanvasTab>('build')

  const [workflowId, setWorkflowId] = useState<string | null>(searchParams.get('id'))
  const [workflowName, setWorkflowName] = useState<string>(
    (location.state as { workflowName?: string })?.workflowName ?? 'My Workflow'
  )

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
        type: n.data?.nodeType === 'condition' ? 'conditionNode' : 'customNode',
        position: n.position,
        data: n.data,
      })))
      setEdges(wf.edges.map(e => ({
        id: e.id, source: e.source, target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
      })))
    }).catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pass run status into node data so CustomNode can render it
  useEffect(() => {
    setNodes(nodes.map((n) => {
      const nState = nodeStates[n.id] ?? 'idle'
      const status = nState === 'active' ? 'running' : nState === 'done' ? 'done' : undefined
      return { ...n, data: { ...n.data, status } }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeStates])

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes(applyNodeChanges(changes, nodes)), [nodes, setNodes])
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges(applyEdgeChanges(changes, edges)), [edges, setEdges])
  const onConnect: OnConnect = useCallback((connection) => setEdges(addEdge({ ...connection, id: `e_${Date.now()}` }, edges)), [edges, setEdges])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode({ id: node.id, type: node.data.nodeType as NodeType, label: String(node.data.label), config: (node.data.config as Record<string, unknown>) ?? {} })
    if (nodeOutputs[node.id]) { setDebugNodeId(node.id); setShowDebug(true) }
  }, [setSelectedNode, nodeOutputs])

  const handleDuplicate = useCallback(() => {
    if (!selectedNode) return
    const original = nodes.find(n => n.id === selectedNode.id)
    if (!original) return
    const newId = `node_${Date.now()}`
    setNodes([...nodes, { ...original, id: newId, position: { x: original.position.x + 50, y: original.position.y + 50 }, selected: false }])
  }, [selectedNode, nodes, setNodes])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedNode) deleteNode(selectedNode.id) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); handleDuplicate() }
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
    setCanvasTab('build')
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
        wf = await updateWorkflow(workflowId, workflowData)
      } else {
        wf = await createWorkflow(workflowData)
        setWorkflowId(wf.id)
      }
      await streamRun(
        wf.id, inputText.trim(),
        (token) => {
          setOutput((prev) => prev + token)
          if (currentNodeRef.current) {
            const nid = currentNodeRef.current
            setNodeOutputs(prev => ({ ...prev, [nid]: (prev[nid] ?? '') + token }))
          }
        },
        () => { setStatus('done'); setCanvasTab('preview') },
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
      setDeployInfo(data); setDeployTab('curl'); setShowDeploy(true)
    } catch (err) { alert('Deploy failed: ' + String(err)) }
  }

  const debugNode = debugNodeId ? nodes.find(n => n.id === debugNodeId) : null

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: active ? '#1e1e3a' : 'transparent',
    color: active ? '#f9fafb' : '#4b5563',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a14' }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
        height: 52, minHeight: 52,
        background: '#0c0c1e', borderBottom: '1px solid #17172e', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#f9fafb', fontWeight: 600, fontSize: 14,
              width: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text',
            }}
          />
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            background: workflowId ? '#34d39918' : '#fbbf2418',
            color: workflowId ? '#34d399' : '#fbbf24',
            border: `1px solid ${workflowId ? '#34d39930' : '#fbbf2430'}`,
            whiteSpace: 'nowrap',
          }}>
            {workflowId ? 'Saved' : 'Draft'}
          </span>
        </div>

        <div style={{ width: 1, height: 20, background: '#1e1e3a', flexShrink: 0 }} />

        <div style={{ display: 'flex', gap: 2, background: '#06060f', borderRadius: 8, padding: '3px' }}>
          {(['build', 'preview', 'monitor'] as CanvasTab[]).map(tab => (
            <button key={tab} onClick={() => setCanvasTab(tab)} style={tabStyle(canvasTab === tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <input
          type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && status !== 'running' && handleRun()}
          placeholder="Ask anything or paste a URL…" disabled={status === 'running'}
          style={{
            width: 260, padding: '6px 12px', borderRadius: 7,
            border: '1px solid #1e1e3a', background: '#06060f',
            color: '#f9fafb', fontSize: 13, outline: 'none',
          }}
        />

        <button onClick={handleDeploy} disabled={nodes.length === 0} style={{
          padding: '6px 14px', borderRadius: 7, border: '1px solid #1e3a4a',
          cursor: 'pointer', background: 'transparent', color: '#38bdf8',
          fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
        }}>
          Deploy
        </button>

        <button onClick={handleRun} disabled={status === 'running' || !inputText.trim()} style={{
          padding: '6px 20px', borderRadius: 7, border: 'none', cursor: 'pointer',
          background: status === 'running' ? '#2a2a4a' : '#7c3aed',
          color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
          opacity: (!inputText.trim() && status !== 'running') ? 0.4 : 1,
        }}>
          {status === 'running' ? 'Running…' : '▶ Run'}
        </button>
      </div>

      {/* Build tab */}
      {canvasTab === 'build' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <NodePalette />
          <div style={{ flex: 1, position: 'relative' }}>
            {nodes.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e1e3a', fontSize: 15, pointerEvents: 'none', zIndex: 10, flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 32 }}>⚡</span>
                <span>Add nodes from the left panel to build your agent</span>
              </div>
            )}
            <ReactFlow
              nodes={nodes} edges={edges} nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
              onNodeClick={onNodeClick} onPaneClick={() => { setSelectedNode(null); setShowDebug(false) }}
              fitView deleteKeyCode={null}
            >
              <Background color="#17172e" gap={20} />
              <Controls />
              <MiniMap
                nodeColor={(n) => (n.data?.baseColor as string) ?? '#4f46e5'}
                maskColor="#0a0a1499"
                style={{ background: '#0c0c1e', border: '1px solid #17172e', borderRadius: 8 }}
              />
            </ReactFlow>

            {showDebug && debugNode && debugNodeId && nodeOutputs[debugNodeId] && (
              <div style={{
                position: 'absolute', bottom: 16, left: 16, width: 320, maxHeight: 240,
                background: '#0c0c1e', border: '1px solid #1e1e3a', borderRadius: 10,
                zIndex: 20, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 24px #00000066',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #1e1e3a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, background: '#7c3aed22', color: '#a78bfa', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                      {String(debugNode.data?.nodeType ?? 'node')}
                    </span>
                    <span style={{ color: '#f9fafb', fontSize: 13, fontWeight: 600 }}>{String(debugNode.data?.label ?? '')}</span>
                  </div>
                  <button onClick={() => setShowDebug(false)} style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
                <div style={{ padding: '10px 14px', overflowY: 'auto', flex: 1 }}>
                  <div style={{ color: '#374151', fontSize: 11, marginBottom: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>Output</div>
                  <pre style={{ margin: 0, color: '#34d399', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {nodeOutputs[debugNodeId]}
                  </pre>
                </div>
              </div>
            )}
          </div>
          {selectedNode && <ConfigPanel />}
        </div>
      )}

      {/* Preview tab */}
      {canvasTab === 'preview' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#06060f', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!output && status === 'idle' && (
              <div style={{ color: '#1e1e3a', fontSize: 15, textAlign: 'center', marginTop: 80 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                Run your agent to see the output here
              </div>
            )}
            {status === 'running' && !output && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700, flexShrink: 0 }}>A</div>
                <div style={{ background: '#0c0c1e', border: '1px solid #17172e', borderRadius: '0 10px 10px 10px', padding: '12px 16px', color: '#a78bfa', fontSize: 14 }}>
                  Thinking…
                </div>
              </div>
            )}
            {output && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700, flexShrink: 0 }}>A</div>
                <div style={{
                  background: '#0c0c1e', border: '1px solid #17172e',
                  borderRadius: '0 10px 10px 10px', padding: '12px 16px',
                  color: status === 'error' ? '#f87171' : '#e5e7eb',
                  fontSize: 14, lineHeight: 1.6, maxWidth: 680, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {output}
                </div>
              </div>
            )}
            {status === 'done' && Object.keys(nodeOutputs).length > 0 && (
              <div style={{ color: '#374151', fontSize: 12, marginLeft: 38 }}>
                · Switch to Build tab and click any green node to inspect its output
              </div>
            )}
          </div>
          <div style={{ padding: '12px 24px', borderTop: '1px solid #17172e', background: '#0c0c1e', display: 'flex', gap: 10 }}>
            <input
              type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && status !== 'running' && handleRun()}
              placeholder="Ask anything or paste a URL…" disabled={status === 'running'}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid #1e1e3a', background: '#06060f', color: '#f9fafb', fontSize: 14, outline: 'none' }}
            />
            <button onClick={handleRun} disabled={status === 'running' || !inputText.trim()} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: status === 'running' ? '#2a2a4a' : '#7c3aed',
              color: '#fff', fontWeight: 600, fontSize: 14,
              opacity: (!inputText.trim() && status !== 'running') ? 0.4 : 1,
            }}>
              {status === 'running' ? '…' : '▶'}
            </button>
          </div>
        </div>
      )}

      {/* Monitor tab */}
      {canvasTab === 'monitor' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06060f', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 36 }}>📊</div>
          <div style={{ color: '#f9fafb', fontWeight: 600, fontSize: 16 }}>Monitor</div>
          <div style={{ color: '#374151', fontSize: 14 }}>Run history, token usage, and latency breakdowns — coming in Phase 5</div>
        </div>
      )}

      {/* Deploy modal */}
      {showDeploy && deployInfo && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000cc', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#0c0c1e', border: '1px solid #1e1e3a', borderRadius: 12, padding: 28, maxWidth: 600, width: '90%' }}>
            <div style={{ color: '#34d399', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🚀 Agent Deployed!</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: '#374151', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Endpoint</div>
              <code style={{ color: '#a78bfa', fontSize: 13 }}>{deployInfo.endpoint}</code>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#374151', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>API Key</div>
              <code style={{ color: '#fbbf24', fontSize: 12, wordBreak: 'break-all' }}>{deployInfo.api_key}</code>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['curl', 'widget'] as const).map(tab => (
                <button key={tab} onClick={() => setDeployTab(tab)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: deployTab === tab ? '#7c3aed' : '#17172e',
                  color: deployTab === tab ? '#fff' : '#6b7280', fontSize: 12, fontWeight: 600,
                }}>{tab === 'curl' ? '⚡ cURL' : '🧩 Widget'}</button>
              ))}
            </div>
            {deployTab === 'curl' && (
              <pre style={{ background: '#06060f', borderRadius: 6, padding: 12, color: '#f9fafb', fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', marginBottom: 20 }}>{deployInfo.curl_example}</pre>
            )}
            {deployTab === 'widget' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: '#374151', fontSize: 11, marginBottom: 8 }}>Drop this in any HTML page to embed your agent as a chat bubble.</div>
                <pre style={{ background: '#06060f', borderRadius: 6, padding: 12, color: '#34d399', fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{deployInfo.widget_snippet}</pre>
                <button onClick={() => navigator.clipboard.writeText(deployInfo!.widget_snippet)}
                  style={{ marginTop: 8, padding: '5px 14px', borderRadius: 6, border: 'none', background: '#17172e', color: '#a78bfa', cursor: 'pointer', fontSize: 12 }}>
                  📋 Copy snippet
                </button>
              </div>
            )}
            <button onClick={() => setShowDeploy(false)}
              style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}