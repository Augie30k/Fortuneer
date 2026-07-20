import { useEffect, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { usePalette, type Palette } from '@/lib/theme'

// Mirrors web's components/HeroGraphic.tsx — arches rising toward a guide
// circle, echoing the growth/organization theme. Geometry is computed in
// pixels from the measured container width (not RN style percentages) so
// every element lines up like the web version's CSS percentages do. Keep
// the two in sync if the design ever changes.

const shadowMd = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.16,
  shadowRadius: 14,
  elevation: 5,
}
const shadowSm = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.2,
  shadowRadius: 6,
  elevation: 3,
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function mixHex(hex: string, mixWith: string, t: number): string {
  const a = hexToRgb(hex)
  const b = hexToRgb(mixWith)
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

/** Gentle infinite bob, matching web's ft-float/ft-float-sm keyframes
 *  (0%/100% translateY(0), 50% translateY(-amplitude)). */
function useFloat(amplitude: number, duration: number, delay = 0) {
  const ty = useSharedValue(0)

  useEffect(() => {
    ty.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-amplitude, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }))
}

/** Radial-gradient dot — the "orb" accent used for the brand mark and the
 *  three rising particles. */
function OrbGlyph({ size, palette, id }: { size: number; palette: Palette; id: string }) {
  if (size <= 0) return null
  const base = palette.chart[0]
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx="32%" cy="28%" r="75%">
          <Stop offset="0%" stopColor={mixHex(base, '#FFFFFF', 0.5)} />
          <Stop offset="55%" stopColor={base} />
          <Stop offset="100%" stopColor={mixHex(base, '#000000', 0.22)} />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
    </Svg>
  )
}

export default function HeroGraphic({
  showBrand = true,
  showTagline = true,
  style,
}: {
  /** Small top-left orb + "Fortuneer" wordmark, as on the web auth panel. */
  showBrand?: boolean
  /** Bottom-anchored tagline, as on the web auth panel. */
  showTagline?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const [outerWidth, setOuterWidth] = useState(0)

  const w = Math.min(outerWidth * 0.8, 410)
  const h = w / 0.92

  const orbitFloat = useFloat(4, 7000)
  const ringFloat = useFloat(7, 9000)
  const orb1Float = useFloat(4, 6000)
  const orb2Float = useFloat(4, 6000, 800)
  const orb3Float = useFloat(7, 7500, 400)

  return (
    <View
      style={[styles.container, { backgroundColor: palette.bg }, style]}
      onLayout={(e) => setOuterWidth(e.nativeEvent.layout.width)}
    >
      {showBrand && (
        <View style={[styles.brandRow, { top: insets.top + 16 }]}>
          <OrbGlyph size={11} palette={palette} id="ftHeroBrandOrb" />
          <Text style={[styles.brandText, { color: palette.text }]}>Fortuneer</Text>
        </View>
      )}

      {w > 0 && (
        <View
          style={{
            width: w,
            height: h,
            marginTop: -outerWidth * 0.02,
            transform: [{ translateX: -w * 0.07 }],
          }}
        >
          {/* architectural guide circle */}
          <View
            style={{
              position: 'absolute',
              top: h * 0.01,
              left: w * 0.5 - (w * 0.74) / 2,
              width: w * 0.74,
              height: w * 0.74,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: withAlpha(palette.text, 0.12),
            }}
          />

          {/* orbiting node on the guide circle */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: h * -0.012,
                left: w * 0.47,
                width: w * 0.042,
                height: w * 0.042,
                borderRadius: 9999,
                backgroundColor: palette.accent,
              },
              shadowSm,
              orbitFloat,
            ]}
          />

          {/* floating ring, upper left */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: h * 0.13,
                left: w * 0.06,
                width: w * 0.15,
                height: w * 0.15,
                borderRadius: 9999,
                borderWidth: 10,
                borderColor: palette.text,
                backgroundColor: 'transparent',
              },
              shadowMd,
              ringFloat,
            ]}
          />

          {/* baseline */}
          <View
            style={{
              position: 'absolute',
              right: -w * 0.04,
              bottom: 0,
              left: -w * 0.04,
              height: 2,
              backgroundColor: withAlpha(palette.text, 0.16),
            }}
          />

          {/* arch 1 — card */}
          <View
            style={[
              styles.arch,
              shadowMd,
              {
                bottom: 2,
                left: w * 0.02,
                width: w * 0.22,
                height: h * 0.34,
                backgroundColor: palette.card,
                borderWidth: 1,
                borderColor: palette.border,
              },
            ]}
          />
          {/* arch 2 — primary */}
          <View
            style={[
              styles.arch,
              shadowMd,
              {
                bottom: 2,
                left: w * 0.28,
                width: w * 0.22,
                height: h * 0.52,
                backgroundColor: palette.accent,
              },
            ]}
          />
          {/* arch 3 — foreground */}
          <View
            style={[
              styles.arch,
              shadowMd,
              {
                bottom: 2,
                left: w * 0.54,
                width: w * 0.22,
                height: h * 0.68,
                backgroundColor: palette.text,
              },
            ]}
          />
          {/* pillar */}
          <View
            style={{
              position: 'absolute',
              bottom: 2,
              left: w * 0.85,
              width: w * 0.03,
              height: h * 0.74,
              borderRadius: 9999,
              backgroundColor: withAlpha(palette.text, 0.34),
            }}
          />

          {/* dome on arch 2 */}
          <View
            style={[
              styles.arch,
              {
                bottom: h * 0.52,
                left: w * 0.34,
                width: w * 0.1,
                height: h * 0.05,
                backgroundColor: palette.card,
                borderWidth: 1,
                borderBottomWidth: 0,
                borderColor: palette.border,
              },
            ]}
          />

          {/* rising orbs */}
          <Animated.View
            style={[
              { position: 'absolute', bottom: h * 0.34, left: w * 0.085, width: w * 0.09, height: w * 0.09 },
              shadowMd,
              orb1Float,
            ]}
          >
            <OrbGlyph size={w * 0.09} palette={palette} id="ftHeroOrb1" />
          </Animated.View>
          <Animated.View
            style={[
              { position: 'absolute', bottom: h * 0.68, left: w * 0.595, width: w * 0.11, height: w * 0.11 },
              shadowMd,
              orb2Float,
            ]}
          >
            <OrbGlyph size={w * 0.11} palette={palette} id="ftHeroOrb2" />
          </Animated.View>
          <Animated.View
            style={[
              { position: 'absolute', bottom: h * 0.725, left: w * 0.7975, width: w * 0.135, height: w * 0.135 },
              shadowMd,
              orb3Float,
            ]}
          >
            <OrbGlyph size={w * 0.135} palette={palette} id="ftHeroOrb3" />
          </Animated.View>
        </View>
      )}

      {showTagline && (
        <View style={[styles.tagline, { bottom: insets.bottom + 40 }]}>
          <Text style={[styles.taglineTitle, { color: palette.text }]}>Organized growth, by design.</Text>
          <Text style={[styles.taglineSub, { color: palette.muted }]}>
            Your financial architecture, one balanced piece at a time.
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandRow: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  arch: { position: 'absolute', borderTopLeftRadius: 9999, borderTopRightRadius: 9999 },
  tagline: {
    position: 'absolute',
    left: 32,
    right: 32,
    alignItems: 'center',
    gap: 6,
  },
  taglineTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  taglineSub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
})
