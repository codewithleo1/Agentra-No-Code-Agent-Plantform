import { useState } from 'react'
import type { NodeMouseHandler } from '@xyflow/react'
import { ReactFlow, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NodeType } from './store/canvasStore'
import { useCanvasStore } from './store/canvasStore'
import ConfigPanel from './components/ConfigPanel'
import { createWorkflow, createRun } from './api'

const BASE_NODES = [
  {
    id: 'n_trigger',
    type: 'default',
    position: { x: 100, y: 200 },
    data: { label: 'Trigger', nodeType: 'trigger', config: { kind: 'manual' } },
    style: { background: '#4f46e5', color: '#fff', borderRadius: 8 },
  },
  {
    id: 'n_llm',
    type: 'default',
    position: { x: 350, y: 200 },
    data: {
      label: 'LLM Call',
      nodeType: 'llm_call',
      config: {
        model: 'openai/gpt-oss-120b',
        system_prompt: 'You are a helpful assistant.',
        user_prompt: 'Say hello in one sentence.',
        temperature: 0.7,
      },
    },
    style: { background: '#7c3aed', color: '#fff', borderRadius: 8 },
  },
  {
    id: 'n_output',
    type: 'default',
    position: { x: 600, y: 200 },
    data: { label: 'Output', nodeType: 'output', config: { store_result: 'false' } },
    style: { background: '#059669', color: '#fff', borderRadius: 8 },
  },
]

const EDGES = [
  { id: 'e1', source: 'n_trigger', target: 'n_llm' },
  { id: 'e2', source: 'n_llm', target: 'n_output' },
]

type RunStatus = 'idle' | 'running' | 'done' | 'error'

export default function App() {
  const { selectedNode, setSelectedNode } = useCanvasStore()
  const [status, setStatus] = useState<RunStatus>('idle')
  const [output, setOutput] = useState<string>('')

  const nodes = BASE_NODES.map((n) => ({
    ...n,
    style: {
      ...n.style,
      border: selectedNode?.id === n.id ? '2px solid #f9fafb' : '2px solid transparent',
      boxShadow: selectedNode?.id === n.id ? '0 0 0 3px #7c3aed' : 'none',
    },
  }))

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    setSelectedNode({
      id: node.id,
      type: node.data.nodeType as NodeType,
      label: String(node.data.label),
      config: (node.data.config as Record<string, unknown>) ?? {},
    })
  }

  const handleRun = async () => {
    setStatus('running')
    setOutput('')
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
      const run = await createRun(wf.id)
      setOutput(run.output ?? '(no output)')
      setStatus('done')
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
          <ReactFlow nodes={nodes} edges={EDGES} onNodeClick={onNodeClick} fitView>
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
          {status === 'running' && <span style={{ color: '#a78bfa' }}>Calling Groq…</span>}
          {status === 'done' && <span style={{ color: '#34d399' }}>{output}</span>}
          {status === 'error' && <span style={{ color: '#f87171' }}>{output}</span>}
        </div>
      )}
    </div>
  )
}