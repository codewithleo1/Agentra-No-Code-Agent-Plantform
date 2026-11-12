import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const initialNodes = [
  {
    id: 'n_trigger',
    type: 'default',
    position: { x: 100, y: 200 },
    data: { label: '⚡ Trigger' },
    style: { background: '#1a1a2e', color: '#fff', border: '2px solid #6366f1', borderRadius: '8px' }
  },
  {
    id: 'n_llm',
    type: 'default',
    position: { x: 350, y: 200 },
    data: { label: '🤖 LLM Call' },
    style: { background: '#1a1a2e', color: '#fff', border: '2px solid #8b5cf6', borderRadius: '8px' }
  },
  {
    id: 'n_output',
    type: 'default',
    position: { x: 600, y: 200 },
    data: { label: '📤 Output' },
    style: { background: '#1a1a2e', color: '#fff', border: '2px solid #10b981', borderRadius: '8px' }
  },
]

const initialEdges = [
  { id: 'e1', source: 'n_trigger', target: 'n_llm', animated: true },
  { id: 'e2', source: 'n_llm', target: 'n_output', animated: true },
]

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f0f1a' }}>
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        fitView
      >
        <Background color="#333" />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}