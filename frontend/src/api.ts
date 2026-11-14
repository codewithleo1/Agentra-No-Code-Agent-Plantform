const BASE = 'http://localhost:8000'

export interface WorkflowPayload {
  name: string
  nodes: unknown[]
  edges: unknown[]
}

export async function createWorkflow(payload: WorkflowPayload) {
  const res = await fetch(`${BASE}/workflows/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function streamRun(
  workflowId: string,
  input: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onNodeState: (nodeId: string, state: 'active' | 'done') => void,
) {
  const res = await fetch(`${BASE}/runs/${workflowId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text)
  }

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
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw) continue
      try {
        const event = JSON.parse(raw)
        if (event.type === 'token') onToken(event.value)
        else if (event.type === 'node_start') onNodeState(event.node_id, 'active')
        else if (event.type === 'node_done') onNodeState(event.node_id, 'done')
        else if (event.type === 'done') onDone()
        else if (event.type === 'error') throw new Error(event.message)
      } catch (e) {
        // skip malformed
      }
    }
  }
}
