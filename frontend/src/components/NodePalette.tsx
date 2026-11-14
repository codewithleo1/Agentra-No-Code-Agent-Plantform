import { useCanvasStore, NODE_COLORS } from '../store/canvasStore'
import type { NodeType } from '../store/canvasStore'

const PALETTE_ITEMS: { type: NodeType; label: string; description: string }[] = [
  { type: 'trigger', label: 'Trigger', description: 'Start the workflow' },
  { type: 'tool', label: 'Web Search', description: 'Search the web (Tavily)' },
  { type: 'tool', label: 'Jina Reader', description: 'Read any URL' },
  { type: 'tool', label: 'HTTP Request', description: 'Call any REST API' },
  { type: 'llm_call', label: 'LLM Call', description: 'Call Groq / GPT' },
  { type: 'condition', label: 'Condition', description: 'Branch on true/false' },
  { type: 'output', label: 'Output', description: 'Display result' },
]

const TOOL_CONFIGS: Record<string, Record<string, unknown>> = {
  'Web Search': {
    tool_id: 'tavily_search',
    params: { query: '{input}', max_results: '5' },
    output_key: 'search_results',
  },
  'Jina Reader': {
    tool_id: 'jina_reader',
    params: { url: '{input}' },
    output_key: 'page_content',
  },
  'HTTP Request': {
    tool_id: 'http_request',
    params: { url: '{input}', method: 'GET', headers: {}, body: '' },
    output_key: 'http_response',
  },
}

export default function NodePalette() {
  const addNode = useCanvasStore((s) => s.addNode)

  const handleAdd = (item: typeof PALETTE_ITEMS[0]) => {
    addNode(item.type)
    if (item.type === 'tool' && TOOL_CONFIGS[item.label]) {
      setTimeout(() => {
        const updated = useCanvasStore.getState().nodes
        const last = updated[updated.length - 1]
        if (!last) return
        useCanvasStore.getState().setNodes(
          updated.map((n) =>
            n.id === last.id
              ? { ...n, data: { ...n.data, label: item.label, config: TOOL_CONFIGS[item.label] } }
              : n
          )
        )
      }, 0)
    }
  }

  return (
    <div style={{
      width: 200,
      background: '#1a1a2e',
      borderRight: '1px solid #2a2a4a',
      padding: '12px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      overflowY: 'auto',
    }}>
      <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, letterSpacing: 1, padding: '0 4px 4px' }}>
        NODES
      </div>
      {PALETTE_ITEMS.map((item) => (
        <button
          key={item.label}
          onClick={() => handleAdd(item)}
          style={{
            background: '#0f0f1a',
            border: `1px solid ${NODE_COLORS[item.type]}44`,
            borderLeft: `3px solid ${NODE_COLORS[item.type]}`,
            borderRadius: 6,
            padding: '8px 10px',
            cursor: 'pointer',
            textAlign: 'left',
            color: '#f9fafb',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.description}</div>
        </button>
      ))}
    </div>
  )
}
