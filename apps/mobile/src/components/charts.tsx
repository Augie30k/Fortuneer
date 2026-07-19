import { useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { formatCurrencyCompact, formatMonth, type CashFlowMonth } from '@fortuneer/shared'

import { usePalette } from '@/lib/theme'

/** Smooth area line chart (net worth / balance history). Pure display — no
 *  axes clutter, just first/last date and min/max value labels. */
export function LineAreaChart({
  points,
  height = 160,
  color,
}: {
  points: { date: string; value: number }[]
  height?: number
  color?: string
}) {
  const palette = usePalette()
  const [width, setWidth] = useState(0)
  const stroke = color ?? palette.accent

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  if (points.length < 2) return null

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const padTop = 8
  const padBottom = 8
  const chartH = height - padTop - padBottom

  const x = (i: number) => (i / (points.length - 1)) * width
  const y = (v: number) => padTop + (1 - (v - min) / span) * chartH

  let path = `M ${x(0)} ${y(values[0])}`
  for (let i = 1; i < points.length; i++) {
    // Catmull-Rom-ish smoothing via midpoint quadratics keeps the line soft
    const mx = (x(i - 1) + x(i)) / 2
    path += ` Q ${mx} ${y(values[i - 1])} ${mx} ${(y(values[i - 1]) + y(values[i])) / 2}`
    path += ` Q ${mx} ${y(values[i])} ${x(i)} ${y(values[i])}`
  }
  const area = `${path} L ${width} ${height} L 0 ${height} Z`
  const last = points[points.length - 1]

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#area)" />
          <Path d={path} stroke={stroke} strokeWidth={2.2} fill="none" strokeLinejoin="round" />
          <Circle cx={x(points.length - 1)} cy={y(last.value)} r={3.5} fill={stroke} />
        </Svg>
      )}
      <View style={styles.axisRow}>
        <Text style={[styles.axisLabel, { color: palette.faint }]}>
          {shortDate(points[0].date)}
        </Text>
        <Text style={[styles.axisLabel, { color: palette.faint }]}>
          {formatCurrencyCompact(min)} – {formatCurrencyCompact(max)}
        </Text>
        <Text style={[styles.axisLabel, { color: palette.faint }]}>{shortDate(last.date)}</Text>
      </View>
    </View>
  )
}

function shortDate(date: string) {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Paired income/expense bars per month. */
export function CashFlowBars({ data, height = 120 }: { data: CashFlowMonth[]; height?: number }) {
  const palette = usePalette()
  const max = Math.max(1, ...data.flatMap((m) => [m.income, m.expenses]))
  return (
    <View>
      <View style={[styles.barsRow, { height }]}>
        {data.map((m) => (
          <View key={m.month} style={styles.barGroup}>
            <View style={styles.barPair}>
              <View
                style={{
                  flex: 1,
                  maxWidth: 10,
                  height: Math.max(3, (m.income / max) * height),
                  borderRadius: 3,
                  backgroundColor: palette.positive,
                }}
              />
              <View
                style={{
                  flex: 1,
                  maxWidth: 10,
                  height: Math.max(3, (m.expenses / max) * height),
                  borderRadius: 3,
                  backgroundColor: palette.dark ? '#FF6961' : '#FF3B30',
                }}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.barsRow}>
        {data.map((m) => (
          <Text key={m.month} style={[styles.barLabel, { color: palette.faint }]}>
            {formatMonth(m.month)}
          </Text>
        ))}
      </View>
    </View>
  )
}

/** Donut with a centered label, for share-of-total breakdowns. */
export function Donut({
  segments,
  size = 132,
  strokeWidth = 16,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string }[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
  centerSub?: string
}) {
  const palette = usePalette()
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - strokeWidth) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r

  let offset = 0
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={c} cy={c} r={r} stroke={palette.inputBg} strokeWidth={strokeWidth} fill="none" />
        {total > 0 &&
          segments.map((s, i) => {
            const frac = s.value / total
            const dash = frac * circumference
            const el = (
              <Circle
                key={i}
                cx={c}
                cy={c}
                r={r}
                stroke={s.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return el
          })}
      </Svg>
      <View style={styles.donutCenter}>
        {centerLabel ? (
          <Text style={[styles.donutLabel, { color: palette.text }]} numberOfLines={1}>
            {centerLabel}
          </Text>
        ) : null}
        {centerSub ? (
          <Text style={[styles.donutSub, { color: palette.muted }]} numberOfLines={1}>
            {centerSub}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisLabel: { fontSize: 11 },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  barGroup: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    justifyContent: 'center',
  },
  barLabel: { flex: 1, fontSize: 10, textAlign: 'center', marginTop: 4 },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  donutLabel: { fontSize: 17, fontWeight: '700' },
  donutSub: { fontSize: 11, marginTop: 1 },
})
