import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import { supabase } from '../lib/supabase'
import type { AuthUser } from '../lib/supabase'

export type NodeType = 'trigger' | 'llm_call' | 'output' | 'tool' | 'condition' | 'memory' | 'email' | 'telegram' | 'sheets'

export interface SelectedNode {
  id: string
  type: NodeType
  label: string
  config: Record<string, unknown>
}

export const NODE_COLORS: Record<NodeType, string> = {
  trigger: '#4f46e5',
  llm_call: '#7c3aed',
  output: '#059669',
  tool: '#0891b2',
  condition: '#f59e0b',
  memory: '#db2777',
  email: '#ea580c',
  telegram: '#0088cc',
  sheets: '#16a34a',
}

export const NODE_DEFAULTS: Record<NodeType, Record<string, unknown>> = {
  trigger: { kind: 'manual' },
  llm_call: {
    model: 'openai/gpt-oss-120b',
    system_prompt: 'You are a helpful assistant.',
    user_prompt: '{input}',
    temperature: 0.7,
  },
  output: { store_result: 'false' },
  tool: {
    tool_id: 'tavily_search',
    params: { query: '{input}', max_results: '5' },
    output_key: 'search_results',
  },
  condition: {
    condition: 'len(state.get("search_results", "")) > 100',
  },
  memory: {
    operation: 'read',
    collection: 'agentra_memory',
    top_k: 3,
    text_key: 'input',
  },
  email: {
    tool_id: 'send_email',
    to: '',
    subject: 'Agent Result',
    body: '{output}',
    output_key: 'email_result',
  },
  telegram: {
    tool_id: 'send_telegram',
    chat_id: '',
    message: '{output}',
    output_key: 'telegram_result',
  },
  sheets: {
    tool_id: 'sheets_append',
    spreadsheet_id: '',
    sheet_name: 'Sheet1',
    operation: 'append',
    values: '{output}',
    output_key: 'sheets_result',
  },
}

interface CanvasStore {
  nodes: Node[]
  edges: Edge[]
  selectedNode: SelectedNode | null
  user: AuthUser | null

  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  addNode: (type: NodeType) => void
  deleteNode: (id: string) => void
  deleteEdge: (id: string) => void
  setSelectedNode: (node: SelectedNode | null) => void
  updateNodeConfig: (key: string, value: unknown) => void
  setUser: (user: AuthUser | null) => void
  signOut: () => Promise<void>
}

let _nodeCounter = 0

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  user: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (type) => {
    _nodeCounter += 1
    const id = `n_${type}_${_nodeCounter}`
    const color = NODE_COLORS[type]
    const config = { ...NODE_DEFAULTS[type] }
    const label =
      type === 'trigger' ? 'Trigger'
      : type === 'llm_call' ? 'LLM Call'
      : type === 'output' ? 'Output'
      : type === 'condition' ? 'Condition'
      : type === 'memory' ? 'Memory'
      : type === 'email' ? 'Send Email'
      : type === 'telegram' ? 'Telegram'
      : type === 'sheets' ? 'Google Sheets'
      : 'Tool'

    const newNode: Node = {
      id,
      type: type === 'condition' ? 'conditionNode' : 'default',
      position: { x: 100 + Math.random() * 300, y: 150 + Math.random() * 100 },
      data: { label, nodeType: type, config, baseColor: color },
      style: type === 'condition' ? undefined : {
        background: color,
        color: '#fff',
        borderRadius: 8,
        border: '2px solid transparent',
      },
    }
    set((state) => ({ nodes: [...state.nodes, newNode] }))
  },

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNode: state.selectedNode?.id === id ? null : state.selectedNode,
    })),

  deleteEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    })),

  setSelectedNode: (node) => set({ selectedNode: node }),

  updateNodeConfig: (key, value) =>
    set((state) => {
      if (!state.selectedNode) return state
      const updatedSelected = {
        ...state.selectedNode,
        config: { ...state.selectedNode.config, [key]: value },
      }
      const updatedNodes = state.nodes.map((n) => {
        if (n.id !== state.selectedNode!.id) return n
        return {
          ...n,
          data: {
            ...n.data,
            config: { ...((n.data.config as Record<string, unknown>) ?? {}), [key]: value },
          },
        }
      })
      return { selectedNode: updatedSelected, nodes: updatedNodes }
    }),

  setUser: (user) => set({ user }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
}))