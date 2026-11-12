import { create } from 'zustand'

export type NodeType = 'trigger' | 'llm_call' | 'output'

export interface SelectedNode {
  id: string
  type: NodeType
  label: string
  config: Record<string, unknown>
}

interface CanvasStore {
  selectedNode: SelectedNode | null
  setSelectedNode: (node: SelectedNode | null) => void
  updateNodeConfig: (key: string, value: unknown) => void
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  selectedNode: null,

  setSelectedNode: (node) => set({ selectedNode: node }),

  updateNodeConfig: (key, value) =>
    set((state) => {
      if (!state.selectedNode) return state
      return {
        selectedNode: {
          ...state.selectedNode,
          config: { ...state.selectedNode.config, [key]: value },
        },
      }
    }),
}))
