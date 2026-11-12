import { useCanvasStore } from '../store/canvasStore'

const fieldsByType = {
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
}

export default function ConfigPanel() {
  const { selectedNode, updateNodeConfig } = useCanvasStore()

  if (!selectedNode) {
    return (
      <div className="config-panel empty">
        <p>Click a node to configure it</p>
      </div>
    )
  }

  const fields = fieldsByType[selectedNode.type] ?? []

  return (
    <div className="config-panel">
      <h2>{selectedNode.label}</h2>
      <p className="node-type">{selectedNode.type}</p>
      <hr />
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
          ) : (
            <input
              type="number"
              value={(selectedNode.config[field.key] as number) ?? ''}
              onChange={(e) => updateNodeConfig(field.key, parseFloat(e.target.value))}
              step="0.1"
              min="0"
              max="1"
            />
          )}
        </div>
      ))}
    </div>
  )
}