import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export default function ConditionNode({ data, selected }: NodeProps) {
  const expr = (data.config as Record<string, unknown>)?.condition as string ?? ''

  return (
    <div style={{
      background: selected ? '#1e1b4b' : '#0f0f1a',
      border: `2px solid ${selected ? '#f9fafb' : '#f59e0b'}`,
      borderRadius: 10,
      padding: '10px 16px',
      minWidth: 160,
      boxShadow: '0 0 16px 4px #f59e0b55',
      position: 'relative',
    }}>
      {/* Input handle — top */}
      <Handle type="target" position={Position.Top} style={{ background: '#f59e0b' }} />

      <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>⬡ Condition</div>
      <div style={{
        fontSize: 11, color: '#d1d5db', fontFamily: 'monospace',
        background: '#1a1a2e', borderRadius: 4, padding: '4px 6px',
        wordBreak: 'break-all',
      }}>
        {expr || 'set condition…'}
      </div>

      {/* True handle — bottom left */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '30%', background: '#34d399' }}
      />
      {/* False handle — bottom right */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '70%', background: '#f87171' }}
      />

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 8, fontSize: 10, color: '#6b7280',
      }}>
        <span style={{ color: '#34d399' }}>✓ true</span>
        <span style={{ color: '#f87171' }}>✗ false</span>
      </div>
    </div>
  )
}
