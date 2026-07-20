import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SymbolView } from 'expo-symbols'

import { usePalette } from '@/lib/theme'
import { SymbolChip, type IconSource } from './ui'

export interface PickerOption {
  key: string
  label: string
  sublabel?: string
  symbol?: IconSource
  color?: string
}

/** iOS-style option sheet for pickers (categories, accounts, presets). */
export default function PickerSheet({
  title,
  visible,
  options,
  selectedKey,
  onSelect,
  onClose,
}: {
  title: string
  visible: boolean
  options: PickerOption[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
  onClose: () => void
}) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { backgroundColor: palette.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <SymbolView name="xmark.circle.fill" size={26} tintColor={palette.faint} />
          </Pressable>
        </View>
        <FlatList
          data={options}
          keyExtractor={(o) => o.key}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}
          renderItem={({ item }) => {
            const selected = item.key === selectedKey
            return (
              <Pressable
                onPress={() => {
                  onSelect(selected ? null : item.key)
                  onClose()
                }}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: palette.card },
                  pressed && { opacity: 0.6 },
                ]}
              >
                {item.symbol ? (
                  <SymbolChip symbol={item.symbol} color={item.color ?? '#8E8E93'} size={30} />
                ) : null}
                <View style={styles.rowBody}>
                  <Text style={[styles.rowLabel, { color: palette.text }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.sublabel ? (
                    <Text style={[styles.rowSub, { color: palette.muted }]} numberOfLines={1}>
                      {item.sublabel}
                    </Text>
                  ) : null}
                </View>
                {selected && (
                  <SymbolView name="checkmark" size={16} tintColor={palette.accent} />
                )}
              </Pressable>
            )
          }}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  title: { fontSize: 17, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 1 },
})
