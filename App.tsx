import { ReactFlow, Background, Controls, MiniMap, NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore, NodeType } from './store/canvasStore'
import ConfigPanel from './components/ConfigPanel'

const initialNodes = [
  {
    id: 'n_trigger',
    type: 'default',
    position: { x: 100, y: 200 },
    data: { label: '⚡ Trigger', nodeType: 'trigger', config: { kind: 'manual' } },
    style: { background: '#1a1a2e', color: '#fff', border: '2px solid #6366f1', borderRadius: '8px' }
  },
  {
    id: 'n_llm',
    type: 'default',
    position: { x: 350, y: 200 },
    data: { label: '🤖 LLM Call', nodeType: 'llm_call', config: { model: 'groq/llama-3.3-70b', temperature: 0.3 } },
    style: { background: '#1a1a2e', color: '#fff', border: '2px solid #8b5cf6', borderRadius: '8px' }
  },
  {
    id: 'n_output',
    type: 'default',
    position: { x: 600, y: 200 },
    data: { label: '📤 Output', nodeType: 'output', config: { store_result: 'true' } },
    style: { background: '#1a1a2e', color: '#fff', border: '2px solid #10b981', borderRadius: '8px' }
  },
]

const initialEdges = [
  { id: 'e1', source: 'n_trigger', target: 'n_llm', animated: true },
  { id: 'e2', source: 'n_llm', target: 'n_output', animated: true },
]

export default function App() {
  const { setSelectedNode } = useCanvasStore()

  const onNodeClick: NodeMouseHandler = (_, node) => {
    setSelectedNode({
      id: node.id,
      type: node.data.nodeType as NodeType,
      label: node.data.label as string,
      config: node.data.config as Record<string, unknown>,
    })
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0f0f1a' }}>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          onNodeClick={onNodeClick}
          fitView
        >
          <Background color="#333" />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      <ConfigPanel />
    </div>
  )
}
