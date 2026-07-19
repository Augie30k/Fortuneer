import { useCallback } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import {
  LIABILITY_ACCOUNT_TYPES,
  formatCurrency,
  formatDate,
  type AccountType,
} from '@fortuneer/shared'

import TransactionRow from '@/components/TransactionRow'
import { LineAreaChart } from '@/components/charts'
import { Card, ErrorBanner, LoadingView, SectionHeader, Separator } from '@/components/ui'
import { ACCOUNT_TYPE_META } from '@/lib/category-icons'
import { loadAccountDetail } from '@/lib/queries'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const palette = usePalette()

  const load = useCallback(() => loadAccountDetail(id), [id])
  const { data, loading, refreshing, error, refresh } = useLoad(load, [id])

  if (loading || !data) return <LoadingView />

  const { account: a, snapshots, transactions } = data
  const isLiability = LIABILITY_ACCOUNT_TYPES.has(a.type)
  const meta = ACCOUNT_TYPE_META[(a.type in ACCOUNT_TYPE_META ? a.type : 'other') as AccountType]

  const facts: { label: string; value: string }[] = [
    {
      label: 'Institution',
      value: a.plaid_items?.institution_name ?? (a.is_manual ? 'Manual account' : '—'),
    },
    { label: 'Type', value: a.subtype ? `${meta.label} · ${a.subtype}` : meta.label },
    ...(a.mask ? [{ label: 'Account number', value: `••${a.mask}` }] : []),
    ...(a.available_balance != null
      ? [{ label: 'Available', value: formatCurrency(a.available_balance) }]
      : []),
    ...(a.is_manual && a.apy > 0
      ? [{ label: 'APY', value: `${a.apy}% · compounds ${a.compound_frequency}` }]
      : []),
    ...(a.plaid_items?.last_synced_at
      ? [{ label: 'Last synced', value: formatDate(a.plaid_items.last_synced_at.slice(0, 10)) }]
      : []),
  ]

  return (
    <>
      <Stack.Screen options={{ title: a.name }} />
      <ScrollView
        style={{ backgroundColor: palette.bg }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <ErrorBanner message={error} />

        <Text style={[styles.caption, { color: palette.muted }]}>
          {isLiability ? 'CURRENT BALANCE OWED' : 'CURRENT BALANCE'}
        </Text>
        <Text style={[styles.balance, { color: palette.text }]}>
          {formatCurrency(a.balance)}
        </Text>
        {a.hidden ? (
          <Text style={[styles.hiddenTag, { color: palette.muted }]}>
            Hidden from dashboard totals
          </Text>
        ) : null}

        {snapshots.length > 1 && (
          <Card style={{ marginTop: 16 }}>
            <LineAreaChart
              points={snapshots.map((s) => ({ date: s.date, value: Number(s.balance) }))}
              color={isLiability ? meta.color : palette.accent}
            />
          </Card>
        )}

        <SectionHeader title="Details" />
        <Card>
          {facts.map((f, i) => (
            <View key={f.label}>
              {i > 0 && <Separator />}
              <View style={styles.factRow}>
                <Text style={[styles.factLabel, { color: palette.muted }]}>{f.label}</Text>
                <Text style={[styles.factValue, { color: palette.text }]} numberOfLines={1}>
                  {f.value}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        <SectionHeader title="Recent transactions" />
        <Card>
          {transactions.length === 0 ? (
            <Text style={[styles.empty, { color: palette.muted }]}>
              No transactions for this account yet.
            </Text>
          ) : (
            transactions.map((t, i) => (
              <View key={t.id}>
                {i > 0 && <Separator inset={46} />}
                <TransactionRow transaction={t} showAccount={false} />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  balance: { fontSize: 34, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  hiddenTag: { fontSize: 12, marginTop: 4 },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  factLabel: { fontSize: 14 },
  factValue: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 24 },
})
