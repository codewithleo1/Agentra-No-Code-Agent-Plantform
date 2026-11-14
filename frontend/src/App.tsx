import { useState, useCallback, useEffect } from 'react'
import type { NodeMouseHandler, OnConnect, OnEdgesChange, OnNodesChange } from '@xyflow/react'
import { ReactFlow, Background, Controls, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NodeType } from './store/canvasStore'
import { useCanvasStore, NODE_COLORS } from './store/canvasStore'
import ConfigPanel from './components/ConfigPanel'
import NodePalette from './components/NodePalette'
import { createWorkflow, streamRun } from './api'

type RunStatus = 'idle' | 'running' | 'done' | 'error'
type NodeState = 'idle' | 'active' | 'done'

function getNodeStyle(baseColor: string, nState: NodeState, isSelected: boolean) {
  const bg = nState === 'active' ? '#facc15' : nState === 'done' ? '#34d399' : baseColor
  return {
    background: bg,
    color: '#fff',
    borderRadius: 8,
    border: isSelected ? '2px solid #f9fafb' : '2px solid transparent',
    boxShadow: nState === 'active'
      ? '0 0 24px 8px #facc15'
      : nState === 'done'
      ? '0 0 16px 4px #34d399'
      : isSelected
      ? '0 0 0 3px #7c3aed'
      : 'none',
    transition: 'all 0.3s ease',
  }
}

export default function App() {
  const { nodes, edges, setNodes, setEdges, selectedNode, setSelectedNode, deleteNode, deleteEdge } = useCanvasStore()
  const [status, setStatus] = useState<RunStatus>('idle')
  const [output, setOutput] = useState<string>('')
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({})
  const [inputText, setInputText] = useState<string>('')

  // Sync node styles when execution state changes
  useEffect(() => {
    setNodes(
      nodes.map((n) => {
        const baseColor = (n.data.baseColor as string) ?? NODE_COLORS[(n.data.nodeType as NodeType)] ?? '#4f46e5'
        const nState = nodeStates[n.id] ?? 'idle'
        const isSelected = selectedNode?.id === n.id
        return { ...n, style: getNodeStyle(baseColor, nState, isSelected) }
      })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeStates, selectedNode])

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes(applyNodeChanges(changes, nodes)),
    [nodes, setNodes]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges(applyEdgeChanges(changes, edges)),
    [edges, setEdges]
  )

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges(addEdge({ ...connection, id: `e_${Date.now()}` }, edges)),
    [edges, setEdges]
  )

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode({
      id: node.id,
      type: node.data.nodeType as NodeType,
      label: String(node.data.label),
      config: (node.data.config as Record<string, unknown>) ?? {},
    })
  }, [setSelectedNode])

  // Delete selected node or edge with Backspace/Delete
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (selectedNode) deleteNode(selectedNode.id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNode, deleteNode])

  const setNodeState = useCallback((nodeId: string, state: NodeState) => {
    setNodeStates((prev) => ({ ...prev, [nodeId]: state }))
  }, [])

  const handleRun = async () => {
    if (!inputText.trim()) return
    if (nodes.length === 0) { setOutput('Add some nodes first.'); setStatus('error'); return }

    setStatus('running')
    setOutput('')
    const resetStates: Record<string, NodeState> = {}
    nodes.forEach((n) => { resetStates[n.id] = 'idle' })
    setNodeStates(resetStates)

    try {
      const wf = await createWorkflow({
        name: 'Canvas Run',
        nodes: nodes.map((n) => ({
          id: n.id,
          type: 'node',
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      })
      await streamRun(
        wf.id,
        inputText.trim(),
        (token) => setOutput((prev) => prev + token),
        () => setStatus('done'),
        (nodeId, state) => setNodeState(nodeId, state),
      )
    } catch (err) {
      setOutput(String(err))
      setStatus('error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f1a' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px', background: '#1a1a2e', borderBottom: '1px solid #2a2a4a',
      }}>
        <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 18 }}>Agentra</span>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && status !== 'running' && handleRun()}
          placeholder="Paste a URL or ask anything…"
          disabled={status === 'running'}
          style={{
            flex: 1, padding: '6px 12px', borderRadius: 6,
            border: '1px solid #2a2a4a', background: '#0f0f1a',
            color: '#f9fafb', fontSize: 14, outline: 'none',
          }}
        />
        <button
          onClick={handleRun}
          disabled={status === 'running' || !inputText.trim()}
          style={{
            padding: '6px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: status === 'running' ? '#4a4a6a' : '#7c3aed',
            color: '#fff', fontWeight: 600, fontSize: 14,
          }}
        >
          {status === 'running' ? 'Running…' : '▶ Run'}
        </button>
      </div>

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NodePalette />
        <div style={{ flex: 1, position: 'relative' }}>
          {nodes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#3a3a5a', fontSize: 15, pointerEvents: 'none', zIndex: 10,
            }}>
              ← Add nodes from the sidebar to build your agent
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedNode(null)}
            fitView
            deleteKeyCode={null}
          >
            <Background color="#2a2a4a" />
            <Controls />
          </ReactFlow>
        </div>
        {selectedNode && <ConfigPanel />}
      </div>

      {/* Output */}
      {status !== 'idle' && (
        <div style={{
          padding: '12px 20px', background: '#1a1a2e', borderTop: '1px solid #2a2a4a',
          minHeight: 60, maxHeight: 160, overflowY: 'auto',
        }}>
          <span style={{ color: '#6b7280', fontSize: 12, marginRight: 8 }}>OUTPUT</span>
          {status === 'running' && !output && <span style={{ color: '#a78bfa' }}>Running…</span>}
          {output && <span style={{ color: status === 'error' ? '#f87171' : '#34d399' }}>{output}</span>}
        </div>
      )}
    </div>
  )
}
