import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import {
  formatCurrency,
  formatDate,
  type DashboardRange,
  type Goal,
  type RecurringStream,
} from '@fortuneer/shared'

import TransactionRow from '@/components/TransactionRow'
import { CashFlowBars, LineAreaChart } from '@/components/charts'
import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingView,
  Pills,
  ProgressBar,
  SectionHeader,
  Separator,
  SymbolChip,
} from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { categorySymbol } from '@/lib/category-icons'
import { loadDashboard, loadGoals, loadRecurring } from '@/lib/queries'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

const RANGE_KEY = 'fortuneer.mobile.dashboard.range'

export default function DashboardScreen() {
  const { session } = useAuth()
  const palette = usePalette()
  const router = useRouter()
  const userId = session!.user.id
  const [range, setRange] = useState<DashboardRange>('6m')

  useEffect(() => {
    AsyncStorage.getItem(RANGE_KEY).then((saved) => {
      if (saved && RANGES.some((r) => r.value === saved)) setRange(saved as DashboardRange)
    })
  }, [])

  const changeRange = (next: DashboardRange) => {
    setRange(next)
    AsyncStorage.setItem(RANGE_KEY, next).catch(() => {})
  }

  const load = useCallback(async () => {
    const [data, recurring, goals] = await Promise.all([
      loadDashboard(userId, range),
      loadRecurring().catch(() => ({ streams: [] as RecurringStream[], monthlyTotal: 0 })),
      loadGoals(userId).catch(() => [] as Goal[]),
    ])
    return { ...data, bills: recurring.streams.slice(0, 5), goals: goals.slice(0, 4) }
  }, [userId, range])

  const { data, loading, refreshing, error, refresh } = useLoad(load, [userId, range])

  if (loading || !data) return <LoadingView />

  const spendDelta =
    data.prevToDateSpending > 0
      ? (data.monthlySpending - data.prevToDateSpending) / data.prevToDateSpending
      : null

  const totalSpend = data.spendingByCategory.reduce((s, c) => s + c.amount, 0)
  const topCategories = data.spendingByCategory.slice(0, 6)
  const otherAmount = data.spendingByCategory.slice(6).reduce((s, c) => s + c.amount, 0)

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <ErrorBanner message={error} />

      {data.accounts.length === 0 ? (
        <Card>
          <EmptyState
            symbol="building.columns.fill"
            title="Welcome to Fortuneer"
            message="Connect a bank account on the web app to see your net worth, cash flow, and spending here."
          />
        </Card>
      ) : (
        <>
          {/* Hero */}
          <Text style={[styles.caption, { color: palette.muted }]}>NET WORTH</Text>
          <Text style={[styles.netWorth, { color: palette.text }]}>
            {formatCurrency(data.netWorth)}
          </Text>
          <View style={styles.heroMeta}>
            <Text style={[styles.heroMetaText, { color: palette.positive }]}>
              {formatCurrency(data.totalAssets)} assets
            </Text>
            <Text style={[styles.heroMetaText, { color: palette.muted }]}>
              {formatCurrency(data.totalLiabilities)} debts
            </Text>
          </View>

          <View style={{ marginTop: 14 }}>
            <Pills options={RANGES} value={range} onChange={changeRange} />
          </View>

          {data.netWorthHistory.length > 1 ? (
            <Card style={{ marginTop: 12 }}>
              <LineAreaChart
                points={data.netWorthHistory.map((p) => ({ date: p.date, value: p.netWorth }))}
              />
            </Card>
          ) : (
            <Card style={{ marginTop: 12 }}>
              <Text style={[styles.emptyChart, { color: palette.muted }]}>
                History builds as your accounts sync each day — check back tomorrow.
              </Text>
            </Card>
          )}

          {/* This month tiles */}
          <View style={styles.tileRow}>
            <Card style={styles.tile}>
              <Text style={[styles.tileLabel, { color: palette.muted }]}>Income</Text>
              <Text style={[styles.tileValue, { color: palette.text }]} numberOfLines={1}>
                {formatCurrency(data.monthlyIncome)}
              </Text>
              <Text style={[styles.tileDelta, { color: palette.faint }]}>
                {formatCurrency(data.prevMonthIncome)} last month
              </Text>
            </Card>
            <Card style={styles.tile}>
              <Text style={[styles.tileLabel, { color: palette.muted }]}>Spending</Text>
              <Text style={[styles.tileValue, { color: palette.text }]} numberOfLines={1}>
                {formatCurrency(data.monthlySpending)}
              </Text>
              {spendDelta != null ? (
                <View style={styles.deltaRow}>
                  <SymbolView
                    name={spendDelta > 0 ? 'arrow.up.right' : 'arrow.down.right'}
                    size={11}
                    tintColor={spendDelta > 0 ? palette.danger : palette.positive}
                  />
                  <Text
                    style={[
                      styles.tileDelta,
                      { color: spendDelta > 0 ? palette.danger : palette.positive },
                    ]}
                  >
                    {Math.abs(spendDelta * 100).toFixed(0)}% vs this time last month
                  </Text>
                </View>
              ) : (
                <Text style={[styles.tileDelta, { color: palette.faint }]}>this month</Text>
              )}
            </Card>
          </View>

          {/* Cash flow */}
          <SectionHeader title="Cash flow" />
          <Card>
            <CashFlowBars data={data.cashFlow} />
          </Card>

          {/* Spending by category */}
          <SectionHeader title="Spending this month" />
          <Card>
            {topCategories.length === 0 ? (
              <Text style={[styles.emptyChart, { color: palette.muted }]}>
                No spending recorded this month yet.
              </Text>
            ) : (
              <>
                {topCategories.map((c, i) => (
                  <View key={c.categoryId}>
                    {i > 0 && <Separator inset={46} />}
                    <CategorySpendRow
                      name={c.name}
                      icon={c.icon}
                      color={c.color ?? palette.chart[i % palette.chart.length]}
                      amount={c.amount}
                      share={totalSpend > 0 ? c.amount / totalSpend : 0}
                    />
                  </View>
                ))}
                {otherAmount > 0 && (
                  <>
                    <Separator inset={46} />
                    <CategorySpendRow
                      name="Other"
                      icon="circle-ellipsis"
                      color="#8E8E93"
                      amount={otherAmount}
                      share={totalSpend > 0 ? otherAmount / totalSpend : 0}
                    />
                  </>
                )}
              </>
            )}
          </Card>

          {/* Upcoming bills */}
          {data.bills.length > 0 && (
            <>
              <SectionHeader
                title="Upcoming bills"
                action={<LinkButton label="All recurring" onPress={() => router.push('/recurring')} />}
              />
              <Card>
                {data.bills.map((b, i) => (
                  <View key={b.key}>
                    {i > 0 && <Separator inset={46} />}
                    <View style={styles.billRow}>
                      <SymbolChip
                        symbol={categorySymbol(b.category?.icon)}
                        color={b.category?.color ?? '#8E8E93'}
                      />
                      <View style={styles.billBody}>
                        <Text style={[styles.billName, { color: palette.text }]} numberOfLines={1}>
                          {b.name}
                        </Text>
                        <Text style={[styles.billMeta, { color: palette.muted }]}>
                          {formatDate(b.nextDate, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      <Text style={[styles.billAmount, { color: palette.text }]}>
                        {formatCurrency(b.averageAmount)}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* Goals */}
          {data.goals.length > 0 && (
            <>
              <SectionHeader
                title="Goals"
                action={<LinkButton label="All goals" onPress={() => router.push('/goals')} />}
              />
              <Card>
                {data.goals.map((g, i) => {
                  const saved = Number(g.saved_amount)
                  const target = Number(g.target_amount)
                  const color = g.color ?? palette.accent
                  return (
                    <View key={g.id} style={{ paddingVertical: 8 }}>
                      {i > 0 && <Separator />}
                      <View style={styles.goalHeader}>
                        <Text style={[styles.billName, { color: palette.text }]} numberOfLines={1}>
                          {g.name}
                        </Text>
                        <Text style={[styles.billMeta, { color: palette.muted }]}>
                          {formatCurrency(saved)} of {formatCurrency(target)}
                        </Text>
                      </View>
                      <View style={{ marginTop: 8 }}>
                        <ProgressBar ratio={target > 0 ? saved / target : 0} color={color} />
                      </View>
                    </View>
                  )
                })}
              </Card>
            </>
          )}

          {/* Recent activity */}
          <SectionHeader
            title="Recent activity"
            action={<LinkButton label="View all" onPress={() => router.push('/transactions')} />}
          />
          <Card>
            {data.recentTransactions.length === 0 ? (
              <Text style={[styles.emptyChart, { color: palette.muted }]}>No transactions yet.</Text>
            ) : (
              data.recentTransactions.map((t, i) => (
                <View key={t.id}>
                  {i > 0 && <Separator inset={46} />}
                  <TransactionRow transaction={t} />
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </ScrollView>
  )
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette()
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={{ color: palette.accent, fontSize: 13, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  )
}

function CategorySpendRow({
  name,
  icon,
  color,
  amount,
  share,
}: {
  name: string
  icon: string | null
  color: string
  amount: number
  share: number
}) {
  const palette = usePalette()
  return (
    <View style={styles.spendRow}>
      <SymbolChip symbol={categorySymbol(icon)} color={color} />
      <View style={styles.spendBody}>
        <View style={styles.spendTop}>
          <Text style={[styles.billName, { color: palette.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.spendAmount, { color: palette.text }]}>
            {formatCurrency(amount)}
          </Text>
        </View>
        <View style={{ marginTop: 6 }}>
          <ProgressBar ratio={share} color={color} height={4} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  netWorth: { fontSize: 38, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  heroMeta: { flexDirection: 'row', gap: 14, marginTop: 4 },
  heroMetaText: { fontSize: 13, fontWeight: '500' },
  emptyChart: { fontSize: 13, textAlign: 'center', paddingVertical: 24, lineHeight: 19 },
  tileRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  tile: { flex: 1 },
  tileLabel: { fontSize: 12, fontWeight: '500' },
  tileValue: { fontSize: 20, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] },
  tileDelta: { fontSize: 11, marginTop: 3 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  billBody: { flex: 1, minWidth: 0 },
  billName: { fontSize: 15, fontWeight: '500' },
  billMeta: { fontSize: 12, marginTop: 1 },
  billAmount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  spendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  spendBody: { flex: 1, minWidth: 0 },
  spendTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  spendAmount: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
})
