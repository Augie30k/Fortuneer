import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SymbolView } from 'expo-symbols'
import {
  formatCurrency,
  type ReportGroup,
  type ReportGroupBy,
  type TransactionWithRefs,
} from '@fortuneer/shared'

import PickerSheet from '@/components/PickerSheet'
import TransactionRow from '@/components/TransactionRow'
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
import { Donut } from '@/components/charts'
import { loadAccounts, loadReports, loadTransactions } from '@/lib/queries'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function presetRange(preset: string): { start: string; end: string } {
  const now = new Date()
  const end = iso(now)
  switch (preset) {
    case 'this-month':
      return { start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { start: iso(start), end: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }
    }
    case '3-months':
      return { start: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), end }
    case 'ytd':
      return { start: iso(new Date(now.getFullYear(), 0, 1)), end }
    case '12-months':
      return { start: iso(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())), end }
    default:
      return { start: '2000-01-01', end }
  }
}

const PRESETS = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: '3-months', label: 'Last 3 months' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12-months', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]

const GROUP_BYS: { value: ReportGroupBy; label: string }[] = [
  { value: 'category', label: 'Category' },
  { value: 'merchant', label: 'Vendor' },
  { value: 'account', label: 'Account' },
]

interface DrillDown {
  label: string
  categoryId?: string
  merchantQuery?: string
  accountId?: string
}

export default function ReportsScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { session } = useAuth()
  const userId = session!.user.id

  const [preset, setPreset] = useState('this-month')
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('category')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [view, setView] = useState<'spending' | 'income'>('spending')
  const [picker, setPicker] = useState<'preset' | 'account' | null>(null)

  const [drill, setDrill] = useState<DrillDown | null>(null)
  const [drillTxns, setDrillTxns] = useState<TransactionWithRefs[]>([])
  const [drillTotal, setDrillTotal] = useState(0)
  const [drillLoading, setDrillLoading] = useState(false)

  const load = useCallback(() => {
    const { start, end } = presetRange(preset)
    return loadReports({ start, end, groupBy, accountId })
  }, [preset, groupBy, accountId])

  const { data, loading, refreshing, error, refresh } = useLoad(load, [
    userId,
    preset,
    groupBy,
    accountId,
  ])

  const { data: accounts } = useLoad(() => loadAccounts(userId), [userId], {
    refetchOnFocus: false,
  })
  const activeAccount = (accounts ?? []).find((a) => a.id === accountId)

  const openDrillDown = async (g: ReportGroup) => {
    const filter: DrillDown =
      groupBy === 'category'
        ? { label: g.name, categoryId: g.key === 'uncategorized' ? undefined : g.key }
        : groupBy === 'account'
          ? { label: g.name, accountId: g.key }
          : { label: g.name, merchantQuery: g.name }
    if (groupBy === 'category' && !filter.categoryId) return
    setDrill(filter)
    setDrillLoading(true)
    try {
      const { start, end } = presetRange(preset)
      const { transactions, total } = await loadTransactions({
        q: filter.merchantQuery,
        categoryId: filter.categoryId,
        accountId: filter.accountId ?? accountId,
        startDate: start,
        endDate: end,
      })
      setDrillTxns(transactions)
      setDrillTotal(total)
    } catch {
      setDrillTxns([])
      setDrillTotal(0)
    } finally {
      setDrillLoading(false)
    }
  }

  if (loading || !data) return <LoadingView />

  const groups = view === 'spending' ? data.groups : data.incomeGroups
  const groupTotal = groups.reduce((s, g) => s + g.amount, 0)
  const top = groups.slice(0, 8)
  const rest = groups.slice(8)
  const restAmount = rest.reduce((s, g) => s + g.amount, 0)

  const colorFor = (g: ReportGroup, i: number) =>
    g.color ?? palette.chart[i % palette.chart.length]

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <ErrorBanner message={error} />

      {/* Scope row */}
      <View style={styles.scopeRow}>
        <ScopeChip
          label={PRESETS.find((p) => p.value === preset)?.label ?? 'Range'}
          onPress={() => setPicker('preset')}
        />
        <ScopeChip
          label={activeAccount?.name ?? 'All accounts'}
          onPress={() => setPicker('account')}
          active={!!accountId}
        />
      </View>

      {/* Summary tiles */}
      <View style={styles.tileRow}>
        <Card style={styles.tile}>
          <Text style={[styles.tileLabel, { color: palette.muted }]}>Income</Text>
          <Text style={[styles.tileValue, { color: palette.positive }]} numberOfLines={1}>
            {formatCurrency(data.income)}
          </Text>
        </Card>
        <Card style={styles.tile}>
          <Text style={[styles.tileLabel, { color: palette.muted }]}>Expenses</Text>
          <Text style={[styles.tileValue, { color: palette.text }]} numberOfLines={1}>
            {formatCurrency(data.expenses)}
          </Text>
        </Card>
        <Card style={styles.tile}>
          <Text style={[styles.tileLabel, { color: palette.muted }]}>Net</Text>
          <Text
            style={[styles.tileValue, { color: data.net >= 0 ? palette.positive : palette.danger }]}
            numberOfLines={1}
          >
            {formatCurrency(data.net)}
          </Text>
        </Card>
      </View>

      <View style={{ marginTop: 16 }}>
        <Pills
          options={[
            { value: 'spending', label: 'Spending' },
            { value: 'income', label: 'Income' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>
      <View style={{ marginTop: 8 }}>
        <Pills options={GROUP_BYS} value={groupBy} onChange={setGroupBy} />
      </View>

      <SectionHeader title={`${view === 'spending' ? 'Spending' : 'Income'} by ${GROUP_BYS.find((g) => g.value === groupBy)?.label.toLowerCase()}`} />
      {top.length === 0 ? (
        <Card>
          <EmptyState
            symbol="chart.bar.xaxis"
            title={view === 'spending' ? 'No spending in this period' : 'No income in this period'}
            message="Try a wider date range."
          />
        </Card>
      ) : (
        <Card>
          <View style={styles.donutWrap}>
            <Donut
              segments={[
                ...top.map((g, i) => ({ value: g.amount, color: colorFor(g, i) })),
                ...(restAmount > 0 ? [{ value: restAmount, color: '#8E8E93' }] : []),
              ]}
              centerLabel={formatCurrency(groupTotal)}
              centerSub={PRESETS.find((p) => p.value === preset)?.label}
            />
          </View>
          {top.map((g, i) => (
            <View key={g.key}>
              {i > 0 && <Separator inset={46} />}
              <Pressable
                style={({ pressed }) => [styles.groupRow, pressed && { opacity: 0.55 }]}
                onPress={() => openDrillDown(g)}
              >
                <SymbolChip
                  symbol={groupBy === 'account' ? 'building.columns.fill' : categorySymbol(g.icon)}
                  color={colorFor(g, i)}
                />
                <View style={styles.groupBody}>
                  <View style={styles.groupTop}>
                    <Text style={[styles.groupName, { color: palette.text }]} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={[styles.groupAmount, { color: palette.text }]}>
                      {formatCurrency(g.amount)}
                    </Text>
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar
                      ratio={groupTotal > 0 ? g.amount / groupTotal : 0}
                      color={colorFor(g, i)}
                      height={4}
                    />
                  </View>
                  <Text style={[styles.groupMeta, { color: palette.faint }]}>
                    {g.count} {g.count === 1 ? 'transaction' : 'transactions'} ·{' '}
                    {groupTotal > 0 ? Math.round((g.amount / groupTotal) * 100) : 0}%
                  </Text>
                </View>
                <SymbolView name="chevron.right" size={12} tintColor={palette.faint} />
              </Pressable>
            </View>
          ))}
          {restAmount > 0 && (
            <>
              <Separator inset={46} />
              <View style={styles.groupRow}>
                <SymbolChip symbol="ellipsis.circle.fill" color="#8E8E93" />
                <View style={styles.groupBody}>
                  <View style={styles.groupTop}>
                    <Text style={[styles.groupName, { color: palette.muted }]}>
                      {rest.length} more
                    </Text>
                    <Text style={[styles.groupAmount, { color: palette.muted }]}>
                      {formatCurrency(restAmount)}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </Card>
      )}

      <PickerSheet
        title="Date range"
        visible={picker === 'preset'}
        options={PRESETS.map((p) => ({ key: p.value, label: p.label }))}
        selectedKey={preset}
        onSelect={(key) => key && setPreset(key)}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        title="Account"
        visible={picker === 'account'}
        options={(accounts ?? []).map((a) => ({
          key: a.id,
          label: a.name,
          sublabel: a.plaid_items?.institution_name ?? (a.is_manual ? 'Manual' : undefined),
        }))}
        selectedKey={accountId}
        onSelect={setAccountId}
        onClose={() => setPicker(null)}
      />

      {/* Drill-down transactions */}
      <Modal
        visible={!!drill}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDrill(null)}
      >
        <View style={[styles.drillSheet, { backgroundColor: palette.bg }]}>
          <View style={styles.drillHeader}>
            <Text style={[styles.drillTitle, { color: palette.text }]} numberOfLines={1}>
              {drill?.label}
            </Text>
            <Pressable onPress={() => setDrill(null)} hitSlop={10}>
              <SymbolView name="xmark.circle.fill" size={26} tintColor={palette.faint} />
            </Pressable>
          </View>
          {drillLoading ? (
            <View style={styles.drillCenter}>
              <ActivityIndicator />
            </View>
          ) : (
            <FlatList
              data={drillTxns}
              keyExtractor={(t) => t.id}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: insets.bottom + 16,
              }}
              renderItem={({ item, index }) => (
                <View
                  style={[
                    { backgroundColor: palette.card, paddingHorizontal: 16 },
                    index === 0 && styles.rowFirst,
                    index === drillTxns.length - 1 && styles.rowLast,
                  ]}
                >
                  {index > 0 && <Separator inset={46} />}
                  {/* Rows are display-only here — the sheet closes over the tab stack */}
                  <TransactionRow transaction={item} disabled />
                </View>
              )}
              ListEmptyComponent={
                <Text style={[styles.drillEmpty, { color: palette.muted }]}>
                  No transactions found.
                </Text>
              }
              ListFooterComponent={
                drillTotal > drillTxns.length ? (
                  <Text style={[styles.drillEmpty, { color: palette.faint }]}>
                    Showing {drillTxns.length} of {drillTotal}
                  </Text>
                ) : null
              }
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  )
}

function ScopeChip({
  label,
  onPress,
  active = true,
}: {
  label: string
  onPress: () => void
  active?: boolean
}) {
  const palette = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? palette.accentSoft : palette.inputBg }]}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '500',
          color: active ? palette.accent : palette.muted,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <SymbolView
        name="chevron.down"
        size={11}
        tintColor={active ? palette.accent : palette.muted}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  scopeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 180,
  },
  tileRow: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, paddingHorizontal: 12 },
  tileLabel: { fontSize: 11, fontWeight: '500' },
  tileValue: { fontSize: 16, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] },
  donutWrap: { alignItems: 'center', paddingVertical: 12 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  groupBody: { flex: 1, minWidth: 0 },
  groupTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  groupName: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  groupAmount: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  groupMeta: { fontSize: 11, marginTop: 4 },
  drillSheet: { flex: 1 },
  drillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  drillTitle: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  drillCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  drillEmpty: { fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  rowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  rowLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
})
