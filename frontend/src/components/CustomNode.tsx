import { Handle, Position } from '@xyflow/react'
import { NODE_COLORS } from '../store/canvasStore'
import type { NodeType } from '../store/canvasStore'

// Inject keyframe animations once into <head>
if (typeof document !== 'undefined' && !document.getElementById('agentra-node-styles')) {
  const el = document.createElement('style')
  el.id = 'agentra-node-styles'
  el.textContent = `
    @keyframes nodeRunPulse {
      0%   { box-shadow: 0 0 0 0px rgba(234,179,8,0.7), 0 0 10px rgba(234,179,8,0.35); }
      60%  { box-shadow: 0 0 0 6px rgba(234,179,8,0.0), 0 0 20px rgba(234,179,8,0.55); }
      100% { box-shadow: 0 0 0 0px rgba(234,179,8,0.0), 0 0 10px rgba(234,179,8,0.35); }
    }
    @keyframes dotBlink {
      0%, 100% { opacity: 1;   transform: scale(1);   }
      50%       { opacity: 0.4; transform: scale(1.5); }
    }
  `
  document.head.appendChild(el)
}

const NODE_ICONS: Record<string, string> = {
  trigger:   '⚡',
  llm:       '🧠',
  tool:      '🔧',
  output:    '📤',
  condition: '⚖️',
  memory:    '💾',
  http:      '🌐',
  transform: '🔄',
  schedule:  '🕐',
  webhook:   '🪝',
}

interface NodeData {
  label: string
  nodeType: NodeType
  baseColor?: string
  status?: 'running' | 'done' | 'error'
  [key: string]: unknown
}

// ── Main pill node ──────────────────────────────────────────────────────────
export default function CustomNode({
  data,
  selected,
}: {
  data: NodeData
  selected: boolean
}) {
  const color      = data.baseColor ?? NODE_COLORS[data.nodeType] ?? '#7c3aed'
  const icon       = NODE_ICONS[data.nodeType] ?? '📦'
  const isRunning  = data.status === 'running'
  const isDone     = data.status === 'done'
  const isError    = data.status === 'error'
  const statusColor = isRunning ? '#eab308'
                    : isDone    ? '#22c55e'
                    : isError   ? '#ef4444'
                    : null

  const handleStyle = {
    width: 10, height: 10,
    background: color,
    border: '2px solid #0c0c1e',
  }

  return (
    <>
      <Handle type="target" position={Position.Left}
        style={{ ...handleStyle, left: -5 }} />

      <div
        title="Double-click to rename"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 16px 7px 12px',
          borderRadius: 100,
          background: '#0c0c1e',
          border: `${isRunning ? 3 : 1.5}px solid ${
            isRunning ? color : selected ? color : color + '55'
          }`,
          minWidth: 120,
          maxWidth: 220,
          cursor: 'default',
          // Pulsing glow when running
          animation: isRunning ? 'nodeRunPulse 1.1s ease-in-out infinite' : 'none',
          transition: 'border-color 0.2s, border-width 0.15s',
        }}
      >
        {/* Icon badge */}
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: color + '22',
          border: `1.5px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, flexShrink: 0,
        }}>
          {icon}
        </div>

        {/* Label */}
        <span style={{
          color: '#e5e7eb', fontSize: 13, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {data.label as string}
        </span>

        {/* Status indicator */}
        {statusColor && (
          <div style={{
            width: isRunning ? 12 : 9,
            height: isRunning ? 12 : 9,
            borderRadius: '50%',
            background: statusColor,
            flexShrink: 0,
            animation: isRunning ? 'dotBlink 0.75s ease-in-out infinite' : 'none',
            boxShadow: isRunning
              ? `0 0 0 3px ${statusColor}44, 0 0 8px ${statusColor}`
              : isDone
              ? `0 0 5px ${statusColor}88`
              : 'none',
            transition: 'width 0.15s, height 0.15s',
          }} />
        )}
      </div>

      <Handle type="source" position={Position.Right}
        style={{ ...handleStyle, right: -5 }} />
    </>
  )
}

// ── Condition node (two source handles: true / false) ───────────────────────
export function ConditionNode({
  data,
  selected,
}: {
  data: NodeData
  selected: boolean
}) {
  const color      = data.baseColor ?? NODE_COLORS['condition'] ?? '#f59e0b'
  const isRunning  = data.status === 'running'
  const isDone     = data.status === 'done'
  const isError    = data.status === 'error'
  const statusColor = isRunning ? '#eab308'
                    : isDone    ? '#22c55e'
                    : isError   ? '#ef4444'
                    : null

  const handleStyle = {
    width: 10, height: 10,
    background: color,
    border: '2px solid #0c0c1e',
  }

  return (
    <>
      <Handle type="target" position={Position.Left}
        style={{ ...handleStyle, left: -5 }} />

      {/* True branch — top-right */}
      <Handle type="source" position={Position.Right} id="true"
        style={{ ...handleStyle, right: -5, top: '28%' }} />

      {/* False branch — bottom-right */}
      <Handle type="source" position={Position.Right} id="false"
        style={{ ...handleStyle, right: -5, top: '72%' }} />

      <div
        title="Double-click to rename"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 16px 7px 12px',
          borderRadius: 100,
          background: '#0c0c1e',
          border: `${isRunning ? 3 : 1.5}px solid ${
            isRunning ? color : selected ? color : color + '55'
          }`,
          minWidth: 140, maxWidth: 220,
          animation: isRunning ? 'nodeRunPulse 1.1s ease-in-out infinite' : 'none',
          transition: 'border-color 0.2s, border-width 0.15s',
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: color + '22', border: `1.5px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, flexShrink: 0,
        }}>⚖️</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.label as string}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>↗ T</span>
            <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>↘ F</span>
          </div>
        </div>

        {statusColor && (
          <div style={{
            width: isRunning ? 12 : 9,
            height: isRunning ? 12 : 9,
            borderRadius: '50%',
            background: statusColor, flexShrink: 0,
            animation: isRunning ? 'dotBlink 0.75s ease-in-out infinite' : 'none',
            boxShadow: isRunning
              ? `0 0 0 3px ${statusColor}44, 0 0 8px ${statusColor}`
              : 'none',
          }} />
        )}
      </div>
    </>
  )
}