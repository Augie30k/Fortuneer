import { useCallback } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import {
  formatCurrency,
  formatDate,
  type RecurringStream,
} from '@fortuneer/shared'

import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingView,
  SectionHeader,
  Separator,
  SymbolChip,
} from '@/components/ui'
import { categorySymbol } from '@/lib/category-icons'
import { loadRecurring } from '@/lib/queries'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

const CADENCE_LABEL: Record<RecurringStream['cadence'], string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export default function RecurringScreen() {
  const palette = usePalette()

  const load = useCallback(() => loadRecurring(), [])
  const { data, loading, refreshing, error, refresh } = useLoad(load, [])

  if (loading || !data) return <LoadingView />

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <ErrorBanner message={error} />

      {data.streams.length === 0 ? (
        <Card>
          <EmptyState
            symbol="repeat"
            title="Nothing recurring detected yet"
            message="Fortuneer looks for repeated charges — the same vendor on a steady weekly, monthly, or yearly rhythm. Sync more history and check back."
          />
        </Card>
      ) : (
        <>
          <Text style={[styles.caption, { color: palette.muted }]}>
            ESTIMATED MONTHLY RECURRING
          </Text>
          <Text style={[styles.total, { color: palette.text }]}>
            {formatCurrency(data.monthlyTotal)}
          </Text>
          <Text style={[styles.streams, { color: palette.muted }]}>
            {data.streams.length} active {data.streams.length === 1 ? 'stream' : 'streams'} ·
            sorted by next charge
          </Text>

          <SectionHeader title="Subscriptions & bills" />
          <Card>
            {data.streams.map((s, i) => (
              <View key={s.key}>
                {i > 0 && <Separator inset={46} />}
                <View style={styles.row}>
                  {s.logo_url ? (
                    <Image source={{ uri: s.logo_url }} style={styles.logo} contentFit="cover" />
                  ) : (
                    <SymbolChip
                      symbol={categorySymbol(s.category?.icon)}
                      color={s.category?.color ?? '#8E8E93'}
                    />
                  )}
                  <View style={styles.body}>
                    <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={[styles.meta, { color: palette.muted }]}>
                      {CADENCE_LABEL[s.cadence]} · {s.occurrences} charges
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={[styles.amount, { color: palette.text }]}>
                      {formatCurrency(s.averageAmount)}
                    </Text>
                    <Text style={[styles.next, { color: palette.faint }]}>
                      Next {formatDate(s.nextDate, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  total: { fontSize: 34, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  streams: { fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  logo: { width: 34, height: 34, borderRadius: 10 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '500' },
  meta: { fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  next: { fontSize: 11, marginTop: 2 },
})
