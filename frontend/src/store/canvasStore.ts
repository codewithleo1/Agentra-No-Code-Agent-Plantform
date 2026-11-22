import { create } from 'zustand'
import {
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'
import { supabase } from '../lib/supabase'

export type NodeType =
  | 'trigger'
  | 'llm_call'
  | 'tool'
  | 'output'
  | 'condition'
  | 'memory'
  | 'email'
  | 'telegram'
  | 'sheets'
  | 'http'
  | 'transform'
  | 'schedule'
  | 'webhook'
  | 'llm'
  | 'slack'
  | 'whatsapp'
  | 'transform'

export const NODE_COLORS: Record<string, string> = {
  trigger:   '#6366f1',
  llm_call:  '#8b5cf6',
  llm:       '#8b5cf6',
  tool:      '#06b6d4',
  output:    '#10b981',
  condition: '#f59e0b',
  memory:    '#ec4899',
  http:      '#3b82f6',
  transform: '#14b8a6',
  schedule:  '#f97316',
  webhook:   '#a855f7',
  email:     '#f43f5e',
  telegram:  '#0ea5e9',
  sheets:    '#22c55e',
  slack:     '#4a154b',
  whatsapp: '#25d366',
  sms: '#0ea5e9',
  transform: '#14b8a6',
}

const NODE_LABELS: Record<string, string> = {
  trigger:   'Trigger',
  llm_call:  'LLM Call',
  llm:       'LLM Call',
  tool:      'Tool',
  output:    'Output',
  condition: 'Condition',
  memory:    'Memory',
  http:      'HTTP',
  transform: 'Transform',
  schedule:  'Schedule',
  webhook:   'Webhook',
  email:     'Send Email',
  telegram:  'Telegram',
  sheets:    'Google Sheets',
  slack:     'Slack',
  whatsapp: 'WhatsApp',
  sms: 'Send SMS',
  transform: 'Transform',
}

type HistoryEntry = { nodes: Node[]; edges: Edge[] }

interface User { id: string; email?: string | null }

interface CanvasState {
  // ── Canvas ────────────────────────────────────────────────────────────────
  nodes: Node[]
  edges: Edge[]

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedNodeId: string | null
  selectedNode: Node | null           // kept in sync; used by ConfigPanel

  // ── Auth ─────────────────────────────────────────────────────────────────
  user: User | null

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  history: HistoryEntry[]
  future: HistoryEntry[]

  // ── Setters ───────────────────────────────────────────────────────────────
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void

  /** Select a node (pass null to deselect) */
  setSelectedNode: (node: Node | null) => void
  /** Convenience alias used by CanvasPage */
  setSelectedNodeId: (id: string | null) => void

  setUser: (user: User | null) => void
  signOut: () => Promise<void>

  // ── React Flow handlers ───────────────────────────────────────────────────
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect:     (connection: Connection) => void

  // ── Node CRUD ─────────────────────────────────────────────────────────────
  addNode: (type: NodeType, label?: string, config?: Record<string, unknown>) => void

  /**
   * Update ONE key in the selected node's config.
   * Signature used by ConfigPanel: updateNodeConfig(key, value)
   */
  updateNodeConfig: (key: string, value: unknown) => void

  /**
   * Replace entire config for a node by id.
   * Signature used by CanvasPage: updateNodeConfigById(id, config)
   */
  updateNodeConfigById: (id: string, config: Record<string, unknown>) => void

  updateNodeLabel: (id: string, label: string) => void
  deleteNode: (id: string) => void
  clearCanvas: () => void

  // ── History ───────────────────────────────────────────────────────────────
  pushHistory: () => void
  undo: () => void
  redo: () => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes:          [],
  edges:          [],
  selectedNodeId: null,
  selectedNode:   null,
  user:           null,
  history:        [],
  future:         [],

  // ── Setters ───────────────────────────────────────────────────────────────
  setNodes: (nodes) =>
    set((state) => {
      const next = typeof nodes === 'function' ? nodes(state.nodes) : nodes
      // Keep selectedNode in sync
      const sel = state.selectedNodeId
        ? next.find((n) => n.id === state.selectedNodeId) ?? null
        : null
      return { nodes: next, selectedNode: sel }
    }),

  setEdges: (edges) =>
    set((state) => ({
      edges: typeof edges === 'function' ? edges(state.edges) : edges,
    })),

  setSelectedNode: (node) =>
    set({ selectedNode: node, selectedNodeId: node?.id ?? null }),

  setSelectedNodeId: (id) =>
    set((state) => ({
      selectedNodeId: id,
      selectedNode: id ? (state.nodes.find((n) => n.id === id) ?? null) : null,
    })),

  setUser: (user) => set({ user }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },

  // ── React Flow handlers ───────────────────────────────────────────────────
  onNodesChange: (changes) => {
    const hasRemove = changes.some((c) => c.type === 'remove')
    if (hasRemove) get().pushHistory()
    set((state) => {
      const next = applyNodeChanges(changes, state.nodes)
      const sel = state.selectedNodeId
        ? next.find((n) => n.id === state.selectedNodeId) ?? null
        : null
      return { nodes: next, selectedNode: sel }
    })
  },

  onEdgesChange: (changes) => {
    const hasRemove = changes.some((c) => c.type === 'remove')
    if (hasRemove) get().pushHistory()
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }))
  },

  onConnect: (connection) => {
    get().pushHistory()
    set((state) => ({
      edges: addEdge(
        { ...connection, animated: true, style: { stroke: '#7c3aed', strokeWidth: 2 } },
        state.edges
      ),
    }))
  },

  // ── Node CRUD ─────────────────────────────────────────────────────────────
  addNode: (type, label, config = {}) => {
    get().pushHistory()
    const { nodes } = get()
    const color    = NODE_COLORS[type] ?? '#7c3aed'
    const id       = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const nodeLabel = label ?? NODE_LABELS[type] ?? type
    // Sequential left-to-right placement
    const col = nodes.length
    const newNode: Node = {
      id,
      type: type === 'condition' ? 'conditionNode' : 'customNode',
      position: { x: 80 + col * 230, y: 200 },
      data: { label: nodeLabel, nodeType: type, config, baseColor: color },
    }
    set((state) => ({ nodes: [...state.nodes, newNode] }))
  },

  /** Used by ConfigPanel — updates one config key on the selected node */
  updateNodeConfig: (key, value) => {
    const { selectedNodeId } = get()
    if (!selectedNodeId) return
    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, config: { ...(n.data.config as Record<string, unknown>), [key]: value } } }
          : n
      )
      return {
        nodes,
        selectedNode: nodes.find((n) => n.id === selectedNodeId) ?? null,
      }
    })
  },

  /** Used by CanvasPage — replaces entire config for a node by id */
  updateNodeConfigById: (id, config) => {
    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, config } } : n
      )
      return {
        nodes,
        selectedNode:
          state.selectedNodeId === id
            ? (nodes.find((n) => n.id === id) ?? null)
            : state.selectedNode,
      }
    })
  },

  updateNodeLabel: (id, label) => {
    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n
      )
      return {
        nodes,
        selectedNode:
          state.selectedNodeId === id
            ? (nodes.find((n) => n.id === id) ?? null)
            : state.selectedNode,
      }
    })
  },

  deleteNode: (id) => {
    get().pushHistory()
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      selectedNode:   state.selectedNodeId === id ? null : state.selectedNode,
    }))
  },

  clearCanvas: () => {
    get().pushHistory()
    set({ nodes: [], edges: [], selectedNodeId: null, selectedNode: null })
  },

  // ── History ───────────────────────────────────────────────────────────────
  pushHistory: () => {
    const { nodes, edges } = get()
    set((state) => ({
      history: [...state.history.slice(-30), { nodes, edges }],
      future:  [],
    }))
  },

  undo: () => {
    const { history, nodes, edges } = get()
    if (history.length === 0) return
    const prev = history[history.length - 1]
    set((state) => ({
      history:      state.history.slice(0, -1),
      future:       [{ nodes, edges }, ...state.future.slice(0, 30)],
      nodes:        prev.nodes,
      edges:        prev.edges,
      selectedNode: null,
      selectedNodeId: null,
    }))
  },

  redo: () => {
    const { future, nodes, edges } = get()
    if (future.length === 0) return
    const next = future[0]
    set((state) => ({
      future:       state.future.slice(1),
      history:      [...state.history.slice(-30), { nodes, edges }],
      nodes:        next.nodes,
      edges:        next.edges,
      selectedNode: null,
      selectedNodeId: null,
    }))
  },
}))