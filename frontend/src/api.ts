const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface WorkflowPayload {
  name: string
  nodes: unknown[]
  edges: unknown[]
}

export interface WorkflowResponse {
  id: string
  name: string
  nodes: unknown[]
  edges: unknown[]
  created_at: string
}

export interface RunResponse {
  id: string
  workflow_id: string
  status: string
  output: string | null
  created_at: string
}

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