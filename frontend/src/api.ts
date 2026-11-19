import { supabase } from './lib/supabase'

const API = 'http://localhost:8000'

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
}

export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}
export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
}
export interface WorkflowPayload {
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}
export interface WorkflowResponse {
  id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  created_at: string
}

export async function createWorkflow(payload: WorkflowPayload): Promise<WorkflowResponse> {
  const headers = await authHeaders()
  const res = await fetch(`${API}/workflows/`, { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function updateWorkflow(id: string, payload: WorkflowPayload): Promise<WorkflowResponse> {
  const headers = await authHeaders()
  const res = await fetch(`${API}/workflows/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getWorkflows(): Promise<WorkflowResponse[]> {
  const headers = await authHeaders()
  const res = await fetch(`${API}/workflows/`, { headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getWorkflow(id: string): Promise<WorkflowResponse> {
  const headers = await authHeaders()
  const res = await fetch(`${API}/workflows/${id}`, { headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function publishWorkflow(id: string): Promise<WorkflowResponse> {
  const headers = await authHeaders()
  const res = await fetch(`${API}/workflows/${id}/publish`, { method: 'PATCH', headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getMarketplace(): Promise<WorkflowResponse[]> {
  const headers = await authHeaders()
  const res = await fetch(`${API}/marketplace/`, { headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function forkWorkflow(id: string): Promise<WorkflowResponse> {
  const headers = await authHeaders()
  const res = await fetch(`${API}/marketplace/${id}/fork`, { method: 'POST', headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function streamRun(
  workflowId: string,
  inputText: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onNodeState: (nodeId: string, state: 'active' | 'done') => void,
): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${API}/runs/${workflowId}/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input: inputText }),
  })
  if (!res.ok) throw new Error(await res.text())
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (!raw) continue
      try {
        const msg = JSON.parse(raw)
        if (msg.type === 'token') onToken(msg.value ?? msg.content ?? '')
        else if (msg.type === 'node_start') onNodeState(msg.node_id, 'active')
        else if (msg.type === 'node_done') onNodeState(msg.node_id, 'done')
        else if (msg.type === 'done') onDone()
      } catch { /* ignore malformed lines */ }
    }
  }
}