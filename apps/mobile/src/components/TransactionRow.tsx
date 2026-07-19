import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import {
  formatSignedAmount,
  relativeDate,
  type TransactionWithRefs,
} from '@fortuneer/shared'

import { categorySymbol } from '@/lib/category-icons'
import { usePalette } from '@/lib/theme'
import { SymbolChip } from './ui'

/** Shared transaction list row. Title follows the web convention: the
 *  display name (merchant_name) when set, else the vendor (description). */
export default function TransactionRow({
  transaction: t,
  showAccount = true,
  disabled = false,
}: {
  transaction: TransactionWithRefs
  showAccount?: boolean
  disabled?: boolean
}) {
  const palette = usePalette()
  const router = useRouter()
  const isInflow = t.amount < 0
  const tint = t.categories?.color ?? '#8E8E93'

  const meta = [
    relativeDate(t.date),
    showAccount && t.accounts ? t.accounts.name : null,
    t.pending ? 'Pending' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && !disabled && { opacity: 0.55 }]}
      onPress={() => router.push(`/transaction/${t.id}`)}
      disabled={disabled}
    >
      {t.logo_url ? (
        <Image source={{ uri: t.logo_url }} style={styles.logo} contentFit="cover" />
      ) : (
        <SymbolChip symbol={categorySymbol(t.categories?.icon)} color={tint} />
      )}
      <View style={styles.body}>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          {t.merchant_name ?? t.description}
        </Text>
        <Text style={[styles.meta, { color: palette.muted }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={styles.right}>
        <Text
          style={[
            styles.amount,
            { color: isInflow ? palette.positive : palette.text },
          ]}
        >
          {formatSignedAmount(t.amount)}
        </Text>
        {t.categories ? (
          <Text style={[styles.category, { color: palette.faint }]} numberOfLines={1}>
            {t.categories.name}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  logo: { width: 34, height: 34, borderRadius: 10 },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '500' },
  meta: { fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end', maxWidth: 130 },
  amount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  category: { fontSize: 11, marginTop: 2 },
})
