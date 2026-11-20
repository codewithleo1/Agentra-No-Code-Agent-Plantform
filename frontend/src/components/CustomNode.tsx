import { Handle, Position } from '@xyflow/react'
import { NODE_COLORS } from '../store/canvasStore'
import type { NodeType } from '../store/canvasStore'

const NODE_ICONS: Record<NodeType, string> = {
  trigger:  '⚡',
  llm_call: '🧠',
  tool:     '🔍',
  condition:'⑂',
  memory:   '🗄',
  output:   '◎',
  email:    '✉️',
  telegram: '✈️',
  sheets:   '📊',
}

interface CustomNodeData {
  nodeType: NodeType
  label: string
  baseColor?: string
  config?: Record<string, unknown>
  status?: 'running' | 'done' | 'error'
}

export default function CustomNode({ data, selected }: { data: CustomNodeData; selected: boolean }) {
  const color = data.baseColor ?? NODE_COLORS[data.nodeType] ?? '#7c3aed'
  const icon  = NODE_ICONS[data.nodeType] ?? '●'

  const statusColor =
    data.status === 'done'    ? '#10b981' :
    data.status === 'error'   ? '#ef4444' :
    data.status === 'running' ? '#f59e0b' :
    null

  return (
    <>
      {/* Left handle (target — incoming edge) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10, height: 10,
          background: color,
          border: '2px solid #0c0c1e',
          left: -5,
        }}
      />

      {/* Node pill */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 16px 7px 12px',
          borderRadius: 100,
          background: '#0c0c1e',
          border: `1.5px solid ${selected ? color : (statusColor ?? color + '55')}`,
          boxShadow: selected
            ? `0 0 0 3px ${color}33`
            : statusColor ? `0 0 0 2px ${statusColor}44` : 'none',
          minWidth: 120,
          maxWidth: 220,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          position: 'relative',
        }}
      >
        {/* Color dot + icon */}
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: color + '22',
          border: `1.5px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13,
        }}>
          {icon}
        </div>

        {/* Label */}
        <span style={{
          color: '#e5e7eb', fontSize: 13, fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {data.label}
        </span>

        {/* Status dot */}
        {statusColor && (
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusColor, flexShrink: 0,
            marginLeft: 4,
          }} />
        )}
      </div>

      {/* Right handle (source — outgoing edge) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10, height: 10,
          background: color,
          border: '2px solid #0c0c1e',
          right: -5,
        }}
      />
    </>
  )
}

// Condition node also needs a false handle — export a variant
export function ConditionNode({ data, selected }: { data: CustomNodeData; selected: boolean }) {
  const color = '#be185d'

  return (
    <>
      <Handle type="target" position={Position.Left}
        style={{ width: 10, height: 10, background: color, border: '2px solid #0c0c1e', left: -5 }}
      />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 16px 7px 12px', borderRadius: 100,
        background: '#0c0c1e',
        border: `1.5px solid ${selected ? color : color + '55'}`,
        boxShadow: selected ? `0 0 0 3px ${color}33` : 'none',
        minWidth: 120, maxWidth: 220, cursor: 'pointer', userSelect: 'none',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: color + '22', border: `1.5px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        }}>⑂</div>
        <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {data.label}
        </span>
      </div>

      {/* True handle — top-right */}
      <Handle type="source" id="true" position={Position.Right}
        style={{ width: 10, height: 10, background: '#10b981', border: '2px solid #0c0c1e', right: -5, top: '30%' }}
      />
      {/* False handle — bottom-right */}
      <Handle type="source" id="false" position={Position.Right}
        style={{ width: 10, height: 10, background: '#ef4444', border: '2px solid #0c0c1e', right: -5, top: '70%' }}
      />
    </>
  )
}