const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface WorkflowPayload { name: string; nodes: unknown[]; edges: unknown[] }
export interface WorkflowResponse { id: string; name: string; nodes: unknown[]; edges: unknown[]; created_at: string }
export interface RunResponse { id: string; workflow_id: string; status: string; output: string | null; created_at: string }

export async function createWorkflow(payload: WorkflowPayload): Promise<WorkflowResponse> {
  const res = await fetch(`${API_BASE}/workflows/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createRun(workflowId: string): Promise<RunResponse> {
  const res = await fetch(`${API_BASE}/runs/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow_id: workflowId }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function streamRun(
  workflowId: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onNodeState?: (nodeId: string, state: 'active' | 'done') => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/runs/${workflowId}/stream`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6)
      try {
        const event = JSON.parse(raw)
        if (event.type === 'token') onToken(event.value)
        else if (event.type === 'node_start') onNodeState?.(event.node_id, 'active')
        else if (event.type === 'node_done') onNodeState?.(event.node_id, 'done')
        else if (event.type === 'done') { onDone(); return }
      } catch { /* ignore non-JSON lines */ }
    }
  }
}
