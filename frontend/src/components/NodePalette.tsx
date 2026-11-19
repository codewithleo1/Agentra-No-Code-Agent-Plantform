import { useCanvasStore, NODE_COLORS } from '../store/canvasStore'
import type { NodeType } from '../store/canvasStore'

const PALETTE_ITEMS: { type: NodeType; label: string; description: string; icon: string }[] = [
  { type: 'trigger',  label: 'Trigger',       description: 'Start the workflow',       icon: '⚡' },
  { type: 'llm_call', label: 'LLM Call',       description: 'Call Groq / GPT',          icon: '🧠' },
  { type: 'tool',     label: 'Web Search',     description: 'Search the web (Tavily)',  icon: '🔍' },
  { type: 'tool',     label: 'Jina Reader',    description: 'Read any URL',             icon: '📄' },
  { type: 'tool',     label: 'HTTP Request',   description: 'Call any REST API',        icon: '🔗' },
  { type: 'condition',label: 'Condition',      description: 'Branch on true/false',     icon: '⑂' },
  { type: 'memory',   label: 'Memory Read',    description: 'Search Qdrant memory',     icon: '🗄' },
  { type: 'memory',   label: 'Memory Write',   description: 'Store into Qdrant',        icon: '💾' },
  { type: 'email',    label: 'Send Email',     description: 'Send via Resend',          icon: '✉️' },
  { type: 'telegram', label: 'Telegram',       description: 'Send Telegram message',    icon: '✈️' },
  { type: 'sheets',   label: 'Google Sheets',  description: 'Read / write rows',        icon: '📊' },
  { type: 'output',   label: 'Output',         description: 'Display result',           icon: '◎' },
]

const TOOL_CONFIGS: Record<string, Record<string, unknown>> = {
  'Web Search': { tool_id: 'tavily_search', params: { query: '{input}', max_results: '5' }, output_key: 'search_results' },
  'Jina Reader': { tool_id: 'jina_reader', params: { url: '{input}' }, output_key: 'page_content' },
  'HTTP Request': { tool_id: 'http_request', params: { url: '{input}', method: 'GET', headers: {}, body: '' }, output_key: 'http_response' },
}

const MEMORY_CONFIGS: Record<string, Record<string, unknown>> = {
  'Memory Read':  { operation: 'read',  collection: 'agentra_memory', top_k: 3, text_key: 'input' },
  'Memory Write': { operation: 'write', collection: 'agentra_memory', top_k: 3, text_key: 'input' },
}

const EMAIL_CONFIG:    Record<string, unknown> = { tool_id: 'send_email',    to: '', subject: 'Agent Result', body: '{output}', output_key: 'email_result' }
const TELEGRAM_CONFIG: Record<string, unknown> = { tool_id: 'send_telegram', chat_id: '', message: '{output}', output_key: 'telegram_result' }
const SHEETS_CONFIG:   Record<string, unknown> = { tool_id: 'sheets_append', spreadsheet_id: '', sheet_name: 'Sheet1', operation: 'append', values: '{output}', output_key: 'sheets_result' }

export default function NodePalette() {
  const addNode = useCanvasStore((s) => s.addNode)

  const handleAdd = (item: typeof PALETTE_ITEMS[0]) => {
    addNode(item.type)
    if (item.type === 'tool' && TOOL_CONFIGS[item.label]) {
      setTimeout(() => {
        const updated = useCanvasStore.getState().nodes
        const last = updated[updated.length - 1]
        if (!last) return
        useCanvasStore.getState().setNodes(updated.map((n) =>
          n.id === last.id ? { ...n, data: { ...n.data, label: item.label, config: TOOL_CONFIGS[item.label] } } : n
        ))
      }, 0)
    }
    if (item.type === 'memory' && MEMORY_CONFIGS[item.label]) {
      setTimeout(() => {
        const updated = useCanvasStore.getState().nodes
        const last = updated[updated.length - 1]
        if (!last) return
        useCanvasStore.getState().setNodes(updated.map((n) =>
          n.id === last.id ? { ...n, data: { ...n.data, label: item.label, config: MEMORY_CONFIGS[item.label] } } : n
        ))
      }, 0)
    }
    if (item.type === 'email') {
      setTimeout(() => {
        const updated = useCanvasStore.getState().nodes
        const last = updated[updated.length - 1]
        if (!last) return
        useCanvasStore.getState().setNodes(updated.map((n) =>
          n.id === last.id ? { ...n, data: { ...n.data, label: 'Send Email', config: EMAIL_CONFIG } } : n
        ))
      }, 0)
    }
    if (item.type === 'telegram') {
      setTimeout(() => {
        const updated = useCanvasStore.getState().nodes
        const last = updated[updated.length - 1]
        if (!last) return
        useCanvasStore.getState().setNodes(updated.map((n) =>
          n.id === last.id ? { ...n, data: { ...n.data, label: 'Telegram', config: TELEGRAM_CONFIG } } : n
        ))
      }, 0)
    }
    if (item.type === 'sheets') {
      setTimeout(() => {
        const updated = useCanvasStore.getState().nodes
        const last = updated[updated.length - 1]
        if (!last) return
        useCanvasStore.getState().setNodes(updated.map((n) =>
          n.id === last.id ? { ...n, data: { ...n.data, label: 'Google Sheets', config: SHEETS_CONFIG } } : n
        ))
      }, 0)
    }
  }

  return (
    <div style={{
      width: 200, minWidth: 200, background: '#0c0c1e',
      borderRight: '1px solid #17172e',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 8px', color: '#6b7280', fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Add
      </div>

      {/* Node rows */}
      {PALETTE_ITEMS.map((item) => (
        <button
          key={item.label}
          onClick={() => handleAdd(item)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '9px 14px', border: 'none', background: 'transparent',
            cursor: 'pointer', textAlign: 'left', width: '100%',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#17172e' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          {/* Color dot with icon */}
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: NODE_COLORS[item.type] + '22',
            border: `1.5px solid ${NODE_COLORS[item.type]}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>
            {item.icon}
          </div>
          {/* Text */}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.label}
            </div>
            <div style={{ color: '#374151', fontSize: 11, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}