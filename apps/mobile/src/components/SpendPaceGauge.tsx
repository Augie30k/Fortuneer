import { View } from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'

// Domain the needle can swing across: ±15% vs. last month's same-day pace.
const DOMAIN = 0.15

// Fixed ramp anchors (green → amber → red), mirroring web's SpendPaceGauge.
const GREEN: RGB = [52, 199, 89] // #34C759
const AMBER: RGB = [255, 149, 0] // #FF9500
const RED: RGB = [255, 59, 48] // #FF3B30

type RGB = [number, number, number]

function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB
}

/** Color at position t ∈ [0,1] along the green → amber → red ramp */
function rampColor(t: number): string {
  const [r, g, b] = t <= 0.5 ? mix(GREEN, AMBER, t * 2) : mix(AMBER, RED, (t - 0.5) * 2)
  return `rgb(${r}, ${g}, ${b})`
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${end.x} ${end.y}`
}

/** Half-circle speedometer: one continuous arc in three color zones
 *  (green / amber / red) vs. last month's spending-to-date. The needle
 *  moves continuously across the whole sweep and its color blends smoothly
 *  along the same ramp. Mirrors web's components/charts/SpendPaceGauge.tsx. */
export default function SpendPaceGauge({
  delta,
  width = 72,
  height = 41,
}: {
  delta: number | null
  width?: number
  height?: number
}) {
  if (delta == null) return null

  const clamped = Math.max(-DOMAIN, Math.min(DOMAIN, delta))
  const needleT = (clamped + DOMAIN) / (2 * DOMAIN) // 0..1 across the sweep
  const needleAngle = needleT * 180 - 90
  const needleColor = rampColor(needleT)

  const cx = 50
  const cy = 46
  const r = 38
  const tip = polarToCartesian(cx, cy, r - 9, needleAngle)

  return (
    <View
      accessibilityLabel={`${Math.abs(Math.round(delta * 100))}% ${delta <= 0 ? 'below' : 'above'} last month's pace`}
    >
      <Svg width={width} height={height} viewBox="0 0 100 58">
        <Path d={describeArc(cx, cy, r, -90, -30)} stroke="#34C759" strokeWidth={9} fill="none" />
        <Path d={describeArc(cx, cy, r, -30, 30)} stroke="#FF9500" strokeWidth={9} fill="none" />
        <Path d={describeArc(cx, cy, r, 30, 90)} stroke="#FF3B30" strokeWidth={9} fill="none" />
        <Line
          x1={cx}
          y1={cy}
          x2={tip.x}
          y2={tip.y}
          stroke={needleColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Circle cx={cx} cy={cy} r={4} fill={needleColor} />
      </Svg>
    </View>
  )
}
