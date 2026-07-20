import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { SymbolView, type SFSymbol } from 'expo-symbols'
import type { LucideIcon } from 'lucide-react-native'

import { usePalette } from '@/lib/theme'

/** Either a native SF Symbol name (OS chrome) or a lucide-react-native
 *  component (branded nav/category/account iconography shared with web). */
export type IconSource = SFSymbol | LucideIcon

/** Renders whichever icon system `icon` belongs to. */
export function AppIcon({
  icon,
  size,
  color,
}: {
  icon: IconSource
  size: number
  color: string
}) {
  if (typeof icon === 'string') {
    return <SymbolView name={icon} tintColor={color} size={size} />
  }
  const Icon = icon
  return <Icon size={size} color={color} />
}

/** iOS grouped-list style card surface. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette()
  return <View style={[styles.card, { backgroundColor: palette.card }, style]}>{children}</View>
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const palette = usePalette()
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: palette.muted }]}>{title.toUpperCase()}</Text>
      {action}
    </View>
  )
}

export function Separator({ inset = 0 }: { inset?: number }) {
  const palette = usePalette()
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        marginLeft: inset,
        backgroundColor: palette.hairline,
      }}
    />
  )
}

/** Tinted rounded-square icon chip, iOS Settings style. Accepts either an SF
 *  Symbol name or a lucide-react-native icon component. */
export function SymbolChip({
  symbol,
  color,
  size = 34,
}: {
  symbol: IconSource
  color: string
  size?: number
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${color}22`,
      }}
    >
      <AppIcon icon={symbol} size={size * 0.55} color={color} />
    </View>
  )
}

/** Horizontal pill selector (segmented control look for ranges/views). */
export function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const palette = usePalette()
  return (
    <View style={[styles.pills, { backgroundColor: palette.inputBg }]}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.pill, active && { backgroundColor: palette.card }]}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? '600' : '400',
                color: active ? palette.text : palette.muted,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function ProgressBar({
  ratio,
  color,
  height = 6,
}: {
  ratio: number
  color: string
  height?: number
}) {
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        overflow: 'hidden',
        backgroundColor: `${color}1F`,
      }}
    >
      <View
        style={{
          width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  )
}

export function EmptyState({
  symbol,
  title,
  message,
}: {
  symbol: SFSymbol
  title: string
  message?: string
}) {
  const palette = usePalette()
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: palette.accentSoft }]}>
        <SymbolView name={symbol} tintColor={palette.accent} size={26} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.emptyMessage, { color: palette.muted }]}>{message}</Text>
      ) : null}
    </View>
  )
}

export function LoadingView() {
  const palette = usePalette()
  return (
    <View style={[styles.fill, { backgroundColor: palette.bg }]}>
      <ActivityIndicator />
    </View>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  const palette = usePalette()
  if (!message) return null
  return (
    <Text style={{ color: palette.danger, fontSize: 13, marginBottom: 10 }} numberOfLines={2}>
      {message}
    </Text>
  )
}

/** Filled accent action button. */
export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  destructive,
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  destructive?: boolean
}) {
  const palette = usePalette()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: destructive ? palette.danger : palette.accent },
        (disabled || loading) && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  pills: {
    flexDirection: 'row',
    borderRadius: 9,
    padding: 2,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 7,
  },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyMessage: { fontSize: 13, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
