import { useCallback } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { formatCurrency } from '@fortuneer/shared'

import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingView,
  SectionHeader,
  Separator,
} from '@/components/ui'
import { loadHoldings, type HoldingWithAccount } from '@/lib/queries'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

export default function InvestmentsScreen() {
  const palette = usePalette()

  const load = useCallback(() => loadHoldings(), [])
  const { data: holdings, loading, refreshing, error, refresh } = useLoad(load, [])

  if (loading || !holdings) return <LoadingView />

  const totalValue = holdings.reduce((s, h) => s + Number(h.value), 0)
  const totalCost = holdings.reduce((s, h) => s + Number(h.cost_basis ?? h.value), 0)
  const totalGain = totalValue - totalCost

  const byAccount = new Map<string, HoldingWithAccount[]>()
  for (const h of holdings) {
    const key = h.accounts?.name ?? 'Portfolio'
    if (!byAccount.has(key)) byAccount.set(key, [])
    byAccount.get(key)!.push(h)
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <ErrorBanner message={error} />

      {holdings.length === 0 ? (
        <Card>
          <EmptyState
            symbol="chart.line.uptrend.xyaxis"
            title="No holdings yet"
            message="Connect an investment account on the web app and your positions show up here."
          />
        </Card>
      ) : (
        <>
          <Text style={[styles.caption, { color: palette.muted }]}>PORTFOLIO VALUE</Text>
          <Text style={[styles.total, { color: palette.text }]}>
            {formatCurrency(totalValue)}
          </Text>
          {totalCost > 0 && Math.abs(totalGain) > 0.005 && (
            <Text
              style={[
                styles.gain,
                { color: totalGain >= 0 ? palette.positive : palette.danger },
              ]}
            >
              {totalGain >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(totalGain))} (
              {((totalGain / totalCost) * 100).toFixed(1)}%) all time
            </Text>
          )}

          {[...byAccount.entries()].map(([accountName, rows]) => (
            <View key={accountName}>
              <SectionHeader
                title={accountName}
                action={
                  <Text style={[styles.subtotal, { color: palette.muted }]}>
                    {formatCurrency(rows.reduce((s, h) => s + Number(h.value), 0))}
                  </Text>
                }
              />
              <Card>
                {rows.map((h, i) => (
                  <View key={h.id}>
                    {i > 0 && <Separator />}
                    <HoldingRow holding={h} />
                  </View>
                ))}
              </Card>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}

function HoldingRow({ holding: h }: { holding: HoldingWithAccount }) {
  const palette = usePalette()
  const value = Number(h.value)
  const cost = h.cost_basis != null ? Number(h.cost_basis) : null
  const gain = cost != null ? value - cost : null
  const quantity = Number(h.quantity)

  return (
    <View style={styles.row}>
      <View style={[styles.ticker, { backgroundColor: palette.accentSoft }]}>
        <Text style={[styles.tickerText, { color: palette.accent }]} numberOfLines={1}>
          {h.ticker ?? (h.name ?? '?').slice(0, 4).toUpperCase()}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
          {h.name ?? h.ticker ?? 'Holding'}
        </Text>
        <Text style={[styles.meta, { color: palette.muted }]} numberOfLines={1}>
          {quantity.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares
          {h.price != null ? ` @ ${formatCurrency(Number(h.price))}` : ''}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.value, { color: palette.text }]}>{formatCurrency(value)}</Text>
        {gain != null && Math.abs(gain) > 0.005 ? (
          <Text
            style={[styles.gainSmall, { color: gain >= 0 ? palette.positive : palette.danger }]}
          >
            {gain >= 0 ? '+' : '−'}
            {formatCurrency(Math.abs(gain))}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  total: { fontSize: 34, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  gain: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  subtotal: { fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  ticker: {
    minWidth: 46,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 7,
    alignItems: 'center',
  },
  tickerText: { fontSize: 12, fontWeight: '700' },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '500' },
  meta: { fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  value: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  gainSmall: { fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] },
})
