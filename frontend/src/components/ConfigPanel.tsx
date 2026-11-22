import { useState, useEffect } from 'react'
import { useCanvasStore, NODE_COLORS } from '../store/canvasStore'
import type { NodeType } from '../store/canvasStore'

const fieldsByType: Record<string, { key: string; label: string; type: string; hint?: string; options?: string[] }[]> = {
  trigger: [
    { key: 'kind', label: 'Trigger Type', type: 'select', options: ['manual', 'webhook', 'schedule'] },
  ],
  llm_call: [
    { key: 'model', label: 'Model', type: 'select', options: ['openai/gpt-oss-120b', 'google/gemini-1.5-flash'] },
    { key: 'system_prompt', label: 'System Prompt', type: 'textarea', hint: 'Sets the AI persona and rules' },
    { key: 'user_prompt', label: 'User Prompt', type: 'textarea', hint: 'Use {input} to pass the user message' },
    { key: 'temperature', label: 'Temperature', type: 'number', hint: '0 = precise · 1 = creative' },
  ],
  output: [
    { key: 'store_result', label: 'Store Result', type: 'select', options: ['false', 'true'] },
  ],
  email: [
    { key: 'to', label: 'To', type: 'text', hint: 'Recipient email address' },
    { key: 'subject', label: 'Subject', type: 'text' },
    { key: 'body', label: 'Body', type: 'textarea', hint: 'Use {output} for the agent result' },
  ],
  telegram: [
    { key: 'chat_id', label: 'Chat ID', type: 'text', hint: 'Your Telegram chat or group ID' },
    { key: 'message', label: 'Message', type: 'textarea', hint: 'Use {output} for the agent result' },
  ],
  slack: [
    { key: 'webhook_url', label: 'Webhook URL', type: 'text', hint: 'Slack Incoming Webhook URL — from api.slack.com/apps' },
    { key: 'message', label: 'Message', type: 'textarea', hint: 'Use {output} for the agent result' },
  ],
  sheets: [
    { key: 'spreadsheet_id', label: 'Spreadsheet ID', type: 'text', hint: 'From the Google Sheets URL' },
    { key: 'sheet_name', label: 'Sheet Name', type: 'text' },
    { key: 'operation', label: 'Operation', type: 'select', options: ['append', 'read'] },
    { key: 'values', label: 'Values', type: 'textarea', hint: 'Use {output} for the agent result' },
  ],
  whatsapp: [
    { key: 'to_number', label: 'To Number', type: 'text', hint: 'Your WhatsApp number e.g. +917028258889' },
    { key: 'message', label: 'Message', type: 'textarea', hint: 'Use {output} for the agent result' },
  ],
  sms: [
    { key: 'to_number', label: 'To Number', type: 'text', hint: 'E.164 format e.g. +917028258889' },
    { key: 'message', label: 'Message', type: 'textarea', hint: 'Use {output} for the agent result' },
  ],
  transform: [
    { key: 'operation', label: 'Operation', type: 'select', options: ['set', 'append', 'prepend', 'uppercase', 'lowercase', 'extract_json', 'replace'] },
    { key: 'input_key', label: 'Input Key', type: 'text', hint: 'State key to read from e.g. output' },
    { key: 'output_key', label: 'Output Key', type: 'text', hint: 'State key to write to e.g. transformed' },
    { key: 'value', label: 'Value / Pattern', type: 'textarea', hint: 'For set/append/prepend: the text. For replace: find|replace. For extract_json: the key name.' },
  ],
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid #17172e', background: '#06060f',
  color: '#e5e7eb', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#6b7280', fontSize: 11,
  fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase',
  marginBottom: 5,
}

const hintStyle: React.CSSProperties = {
  color: '#374151', fontSize: 11, marginTop: 4,
}

export default function ConfigPanel() {
  const { selectedNode, updateNodeConfig, deleteNode, setSelectedNode } = useCanvasStore()
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [scheduleStatus, setScheduleStatus] = useState<string>('')

  useEffect(() => {
    const stored = localStorage.getItem('last_workflow_id')
    if (stored) setWorkflowId(stored)
  }, [])

  if (!selectedNode) return null

  const nodeType = selectedNode.data.nodeType as string
  const fields = fieldsByType[nodeType] ?? []
  const color = NODE_COLORS[nodeType] ?? '#7c3aed'
  const config = selectedNode.data.config as Record<string, unknown>
  const isWebhook  = nodeType === 'trigger' && config['kind'] === 'webhook'
  const isSchedule = nodeType === 'trigger' && config['kind'] === 'schedule'
  const webhookUrl = workflowId ? `http://localhost:8000/webhook/${workflowId}` : 'Run or Deploy first to get URL'

  return (
    <div style={{
      width: 280, minWidth: 280, background: '#0c0c1e',
      borderLeft: '1px solid #17172e',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid #17172e',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: color + '22', border: `1.5px solid ${color}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
          }}>
            {{ trigger:'⚡', llm_call:'🧠', tool:'🔍', condition:'⑂', memory:'🗄', output:'◎', email:'✉️', telegram:'✈️', sheets:'📊', slack:'💬' }[nodeType] ?? '●'}
          </div>
          <div>
            <div style={{ color: '#f9fafb', fontSize: 14, fontWeight: 600 }}>{selectedNode.data.label as string}</div>
            <div style={{ color: color, fontSize: 11, marginTop: 1 }}>{nodeType}</div>
          </div>
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 2 }}
        >×</button>
      </div>

      {/* Fields */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

        {/* Schedule fields */}
        {isSchedule && (
          <div>
            <label style={labelStyle}>Cron Expression</label>
            <input
              type="text" style={inputStyle}
              value={(config['cron'] as string) ?? '0 9 * * *'}
              onChange={(e) => updateNodeConfig('cron', e.target.value)}
              placeholder="0 9 * * *"
            />
            <div style={hintStyle}>min · hour · day · month · weekday (UTC)</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                onClick={async () => {
                  if (!workflowId) { setScheduleStatus('Save workflow first'); return }
                  const res = await fetch(`http://localhost:8000/schedule/${workflowId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cron: (config['cron'] as string) ?? '0 9 * * *', input: '', base_url: 'https://your-render-url.onrender.com' }),
                  })
                  const data = await res.json()
                  setScheduleStatus(res.ok ? `✓ Scheduled — ID: ${data.schedule_id}` : `Error: ${data.detail}`)
                }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                Schedule
              </button>
              <button
                onClick={async () => {
                  if (!workflowId) return
                  await fetch(`http://localhost:8000/schedule/${workflowId}`, { method: 'DELETE' })
                  setScheduleStatus('Unscheduled')
                }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid #17172e', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}
              >
                Unschedule
              </button>
            </div>
            {scheduleStatus && <div style={{ fontSize: 11, marginTop: 8, color: '#34d399' }}>{scheduleStatus}</div>}
          </div>
        )}

        {/* Webhook URL */}
        {isWebhook && (
          <div>
            <label style={labelStyle}>Webhook URL</label>
            <div style={{ background: '#06060f', border: '1px solid #17172e', borderRadius: 6, padding: '8px 10px' }}>
              <code style={{ fontSize: 11, wordBreak: 'break-all', color: '#34d399', display: 'block', marginBottom: workflowId ? 8 : 0 }}>
                {webhookUrl}
              </code>
              {workflowId && (
                <button
                  onClick={() => navigator.clipboard.writeText(webhookUrl)}
                  style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: '#17172e', color: '#a78bfa', cursor: 'pointer', fontSize: 11 }}
                >
                  Copy
                </button>
              )}
            </div>
            <div style={hintStyle}>POST JSON: {'{"input": "your text"}'}</div>
          </div>
        )}

        {/* Regular fields */}
        {fields.map((field) => (
          <div key={field.key}>
            <label style={labelStyle}>{field.label}</label>
            {field.type === 'textarea' ? (
              <textarea
                value={(config[field.key] as string) ?? ''}
                onChange={(e) => updateNodeConfig(field.key, e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            ) : field.type === 'select' ? (
              <select
                value={(config[field.key] as string) ?? ''}
                onChange={(e) => updateNodeConfig(field.key, e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">Select…</option>
                {field.options!.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'number' ? (
              <input
                type="number" step="0.1" min="0" max="1"
                value={(config[field.key] as number) ?? ''}
                onChange={(e) => updateNodeConfig(field.key, parseFloat(e.target.value))}
                style={inputStyle}
              />
            ) : (
              <input
                type="text"
                value={(config[field.key] as string) ?? ''}
                onChange={(e) => updateNodeConfig(field.key, e.target.value)}
                placeholder={field.label}
                style={inputStyle}
              />
            )}
            {field.hint && <div style={hintStyle}>{field.hint}</div>}
          </div>
        ))}

        {/* Tool / Memory / Condition — read-only config summary */}
        {['tool', 'memory', 'condition'].includes(nodeType) && fields.length === 0 && (
          <div style={{ background: '#06060f', border: '1px solid #17172e', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#374151', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Config</div>
            <pre style={{ margin: 0, color: '#6b7280', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Delete button at bottom */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #17172e' }}>
        <button
          onClick={() => { deleteNode(selectedNode.id); setSelectedNode(null) }}
          style={{
            width: '100%', padding: '7px 0', borderRadius: 6,
            border: '1px solid #3f1515', background: 'transparent',
            color: '#f87171', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          Delete Node
        </button>
      </div>
    </div>
  )
}