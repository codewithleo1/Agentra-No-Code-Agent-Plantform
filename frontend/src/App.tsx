import { useState, useCallback, useEffect } from 'react'
import type { NodeMouseHandler } from '@xyflow/react'
import { ReactFlow, Background, Controls, useNodesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NodeType } from './store/canvasStore'
import { useCanvasStore } from './store/canvasStore'
import ConfigPanel from './components/ConfigPanel'
import { createWorkflow, streamRun } from './api'

const BASE_NODES = [
  {
    id: 'n_trigger',
    type: 'default',
    position: { x: 100, y: 200 },
    data: { label: 'Trigger', nodeType: 'trigger', config: { kind: 'manual' } },
    baseColor: '#4f46e5',
  },
  {
    id: 'n_search',
    type: 'default',
    position: { x: 320, y: 200 },
    data: {
      label: 'Web Search',
      nodeType: 'tool',
      config: {
        tool_id: 'tavily_search',
        params: { query: '{input}', max_results: '5' },
        output_key: 'search_results',
      },
    },
    baseColor: '#0ea5e9',
  },
  {
    id: 'n_llm',
    type: 'default',
    position: { x: 540, y: 200 },
    data: {
      label: 'LLM Call',
      nodeType: 'llm_call',
      config: {
        model: 'openai/gpt-oss-120b',
        system_prompt: 'You are a helpful assistant. Use the search results provided to answer the question.',
        user_prompt: 'Question: {input}\n\nSearch Results:\n{search_results}',
        temperature: 0.7,
      },
    },
    baseColor: '#7c3aed',
  },
  {
    id: 'n_output',
    type: 'default',
    position: { x: 760, y: 200 },
    data: { label: 'Output', nodeType: 'output', config: { store_result: 'false' } },
    baseColor: '#059669',
  },
]

const EDGES = [
  { id: 'e1', source: 'n_trigger', target: 'n_search' },
  { id: 'e2', source: 'n_search', target: 'n_llm' },
  { id: 'e3', source: 'n_llm', target: 'n_output' },
]

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
  const { selectedNode, setSelectedNode } = useCanvasStore()
  const [status, setStatus] = useState<RunStatus>('idle')
  const [output, setOutput] = useState<string>('')
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({})

  const [nodes, setNodes, onNodesChange] = useNodesState(
    BASE_NODES.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { ...n.data, baseColor: n.baseColor },
      style: getNodeStyle(n.baseColor, 'idle', false),
    }))
  )

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const base = BASE_NODES.find((b) => b.id === n.id)!
        const nState = nodeStates[n.id] ?? 'idle'
        const isSelected = selectedNode?.id === n.id
        return { ...n, style: getNodeStyle(base.baseColor, nState, isSelected) }
      })
    )
  }, [nodeStates, selectedNode, setNodes])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode({
      id: node.id,
      type: node.data.nodeType as NodeType,
      label: String(node.data.label),
      config: (node.data.config as Record<string, unknown>) ?? {},
    })
  }, [setSelectedNode])

  const setNodeState = useCallback((nodeId: string, state: NodeState) => {
    setNodeStates((prev) => ({ ...prev, [nodeId]: state }))
  }, [])

  const handleRun = async () => {
    setStatus('running')
    setOutput('')
    setNodeStates({ n_trigger: 'idle', n_search: 'idle', n_llm: 'idle', n_output: 'idle' })

    try {
      const wf = await createWorkflow({
        name: 'Canvas Run',
        nodes: BASE_NODES.map((n) => ({
          id: n.id,
          type: 'node',
          position: n.position,
          data: n.data,
        })),
        edges: EDGES.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      })
      await streamRun(
        wf.id,
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
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px', background: '#1a1a2e', borderBottom: '1px solid #2a2a4a',
      }}>
        <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 18 }}>Agentra</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleRun}
          disabled={status === 'running'}
          style={{
            padding: '6px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: status === 'running' ? '#4a4a6a' : '#7c3aed',
            color: '#fff', fontWeight: 600, fontSize: 14,
          }}
        >
          {status === 'running' ? 'Running…' : '▶ Run'}
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={EDGES}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            fitView
          >
            <Background color="#2a2a4a" />
            <Controls />
          </ReactFlow>
        </div>
        {selectedNode && <ConfigPanel />}
      </div>

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
