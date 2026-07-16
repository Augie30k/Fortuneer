'use client'

import { useState } from 'react'
import { ResponsiveContainer, Sankey, Tooltip, Rectangle, Layer } from 'recharts'
import type { SankeyData, SankeyNodeData } from '@/lib/types'
import { formatCurrency } from '@/lib/format'

interface SankeyNodeShape {
  x: number
  y: number
  width: number
  height: number
  index: number
  payload: SankeyNodeData & { value: number }
  containerWidth: number
}

interface SankeyLinkShape {
  sourceX: number
  sourceY: number
  sourceControlX: number
  targetX: number
  targetY: number
  targetControlX: number
  linkWidth: number
  index: number
  payload: {
    source: SankeyNodeData
    target: SankeyNodeData
  }
}

export interface SankeySelection {
  name: string
  categoryId?: string
  merchantName?: string
}

function SankeyLink({
  onSelect,
  ...props
}: { onSelect: (selection: SankeySelection) => void } & Record<string, unknown>) {
  const {
    sourceX,
    sourceY,
    sourceControlX,
    targetX,
    targetY,
    targetControlX,
    linkWidth,
    index,
    payload,
  } = props as unknown as SankeyLinkShape
  const [hovered, setHovered] = useState(false)

  // Every node (including the hub) carries a real color, so each ribbon is a
  // smooth, fully-colorful blend from its source into its target — no gray
  const sourceColor = payload.source?.color ?? 'var(--chart-hub)'
  const targetColor = payload.target?.color ?? 'var(--chart-hub)'
  const gradientId = `sankey-link-${index}`

  // The hub is the only node literally named "Budget" — the clickable,
  // informative endpoint is whichever side isn't it
  const target = payload.source?.name !== 'Budget' ? payload.source : payload.target
  const clickable = !!(target?.categoryId || target?.merchantName)

  const path = `
    M${sourceX},${sourceY + linkWidth / 2}
    C${sourceControlX},${sourceY + linkWidth / 2} ${targetControlX},${targetY + linkWidth / 2} ${targetX},${targetY + linkWidth / 2}
    L${targetX},${targetY - linkWidth / 2}
    C${targetControlX},${targetY - linkWidth / 2} ${sourceControlX},${sourceY - linkWidth / 2} ${sourceX},${sourceY - linkWidth / 2}
    Z
  `

  return (
    <g
      key={`link-${index}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => clickable && target && onSelect(target)}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      <defs>
        {/* Smooth, continuous blend — no hard stop, no neutral midpoint */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={sourceColor} stopOpacity={hovered ? 0.65 : 0.45} />
          <stop offset="100%" stopColor={targetColor} stopOpacity={hovered ? 0.65 : 0.45} />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#${gradientId})`} stroke="none" />
    </g>
  )
}

function SankeyNode(props: unknown) {
  const { x, y, width, height, index, payload, containerWidth } = props as SankeyNodeShape
  const isRightSide = x + width > containerWidth / 2
  const fill = payload.color ?? 'var(--muted-foreground)'
  const labelX = isRightSide ? x - 6 : x + width + 6
  const showLabel = height > 10

  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} radius={2} />
      {showLabel && (
        <>
          <text
            x={labelX}
            y={y + height / 2 - 2}
            textAnchor={isRightSide ? 'end' : 'start'}
            dominantBaseline="auto"
            fontSize={12}
            fontWeight={500}
            fill="var(--foreground)"
          >
            {payload.name}
          </text>
          <text
            x={labelX}
            y={y + height / 2 + 12}
            textAnchor={isRightSide ? 'end' : 'start'}
            fontSize={11}
            fill="var(--muted-foreground)"
          >
            {formatCurrency(payload.value, 'USD', { maximumFractionDigits: 0 })}
          </text>
        </>
      )}
    </Layer>
  )
}

export default function SankeyChart({
  data,
  onSelect,
}: {
  data: SankeyData
  onSelect?: (selection: SankeySelection) => void
}) {
  if (data.links.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Not enough activity in this period to draw a cash flow.
      </p>
    )
  }

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={data}
          node={<SankeyNode />}
          link={<SankeyLink onSelect={onSelect ?? (() => {})} />}
          nodePadding={24}
          nodeWidth={8}
          margin={{ top: 16, right: 130, bottom: 16, left: 130 }}
        >
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              interface SankeyHover {
                source?: { name: string }
                target?: { name: string }
                value?: number
                name?: string
                payload?: SankeyHover
              }
              const p = payload[0].payload as SankeyHover
              const inner = p.payload ?? p
              const title = inner.source && inner.target
                ? `${inner.source.name} → ${inner.target.name}`
                : (inner.name ?? '')
              const value = inner.value ?? p.value ?? 0
              return (
                <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10">
                  <p className="font-medium">{title}</p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">
                    {formatCurrency(value)}
                  </p>
                  {onSelect && <p className="mt-1 text-[10px] text-muted-foreground">Click to view transactions</p>}
                </div>
              )
            }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}
