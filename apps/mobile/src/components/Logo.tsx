import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { usePalette } from '@/lib/theme'

// Mirrors web's components/Logo.tsx exactly (same gradient, glyph bars, and
// accent dot) so both platforms show the same mark — keep the two in sync.
function LogoMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <LinearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#3395FF" />
          <Stop offset="100%" stopColor="#0071E3" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="512" height="512" rx="146" fill="url(#logoGradient)" />
      <Rect x="154" y="123" width="56" height="266" rx="28" fill="#FFFFFF" />
      <Rect x="154" y="123" width="195" height="56" rx="28" fill="#FFFFFF" />
      <Rect x="154" y="230" width="148" height="56" rx="28" fill="#FFFFFF" opacity={0.6} />
      <Circle cx="343" cy="353" r="36" fill="#FF9500" />
    </Svg>
  )
}

export default function Logo({
  size = 28,
  style,
}: {
  size?: number
  style?: StyleProp<ViewStyle>
}) {
  const palette = usePalette()
  return (
    <View style={[styles.row, style]}>
      <View
        style={[
          styles.markShadow,
          { width: size, height: size, borderRadius: size * (146 / 512) },
        ]}
      >
        <LogoMark size={size} />
      </View>
      <Text
        style={[
          styles.wordmark,
          { fontSize: size * 0.64, letterSpacing: -size * 0.016, color: palette.text },
        ]}
      >
        Fortuneer
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  wordmark: { fontWeight: '600' },
})
