import { useState, useEffect } from 'react'
import { useCanvasStore } from '../store/canvasStore'

const fieldsByType: Record<string, { key: string; label: string; type: string; options?: string[] }[]> = {
  trigger: [
    { key: 'kind', label: 'Trigger Type', type: 'select', options: ['manual', 'webhook', 'schedule'] },
  ],
  llm_call: [
    { key: 'model', label: 'Model', type: 'select', options: ['groq/llama-3.3-70b', 'google/gemini-1.5-flash'] },
    { key: 'system_prompt', label: 'System Prompt', type: 'textarea' },
    { key: 'user_prompt', label: 'User Prompt', type: 'textarea' },
    { key: 'temperature', label: 'Temperature', type: 'number' },
  ],
  output: [
    { key: 'store_result', label: 'Store Result', type: 'select', options: ['true', 'false'] },
  ],
  email: [
    { key: 'to', label: 'To Email', type: 'text' },
    { key: 'subject', label: 'Subject', type: 'text' },
    { key: 'body', label: 'Body (use {output} for agent result)', type: 'textarea' },
  ],
}

export default function ConfigPanel() {
  const { selectedNode, updateNodeConfig } = useCanvasStore()
  const [workflowId, setWorkflowId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('last_workflow_id')
    if (stored) setWorkflowId(stored)
  }, [])

  if (!selectedNode) {
    return (
      <div className="config-panel empty">
        <p>Click a node to configure it</p>
      </div>
    )
  }

  const fields = fieldsByType[selectedNode.type] ?? []
  const isWebhookTrigger = selectedNode.type === 'trigger' && selectedNode.config['kind'] === 'webhook'
  const webhookUrl = workflowId
    ? `http://localhost:8000/webhook/${workflowId}`
    : 'Run or Deploy first to get URL'

  return (
    <div className="config-panel">
      <h2>{selectedNode.label}</h2>
      <p className="node-type">{selectedNode.type}</p>
      <hr />
      {isWebhookTrigger && (
        <div className="field">
          <label>Webhook URL</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <code style={{ fontSize: 11, wordBreak: 'break-all', color: '#34d399', flex: 1 }}>
              {webhookUrl}
            </code>
            {workflowId && (
              <button
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
                style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: '#2a2a4a', color: '#a78bfa', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}
              >
                Copy
              </button>
            )}
          </div>
          <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
            POST JSON: {'{"input": "your text"}'}
          </div>
        </div>
      )}
      {fields.map((field) => (
        <div key={field.key} className="field">
          <label>{field.label}</label>
          {field.type === 'textarea' ? (
            <textarea
              value={(selectedNode.config[field.key] as string) ?? ''}
              onChange={(e) => updateNodeConfig(field.key, e.target.value)}
              rows={3}
            />
          ) : field.type === 'select' ? (
            <select
              value={(selectedNode.config[field.key] as string) ?? ''}
              onChange={(e) => updateNodeConfig(field.key, e.target.value)}
            >
              <option value="">Select...</option>
              {field.options!.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'number' ? (
            <input
              type="number"
              value={(selectedNode.config[field.key] as number) ?? ''}
              onChange={(e) => updateNodeConfig(field.key, parseFloat(e.target.value))}
              step="0.1"
              min="0"
              max="1"
            />
          ) : (
            <input
              type="text"
              value={(selectedNode.config[field.key] as string) ?? ''}
              onChange={(e) => updateNodeConfig(field.key, e.target.value)}
              placeholder={field.label}
            />
          )}
        </div>
      ))}
    </div>
  )
}
