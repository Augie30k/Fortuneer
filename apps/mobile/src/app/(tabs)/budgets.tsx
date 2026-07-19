import { useCallback, useMemo, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import {
  formatCurrency,
  goalMonthAmount,
  goalMonthlyBudget,
  liveGoalAutoSaveAmounts,
  monthName,
  nextMonth,
  projectedFinishMonth,
  type BudgetWithSpend,
  type Goal,
} from '@fortuneer/shared'

import PickerSheet from '@/components/PickerSheet'
import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingView,
  ProgressBar,
  SectionHeader,
  Separator,
  SymbolChip,
} from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { categorySymbol } from '@/lib/category-icons'
import { loadBudgets, loadCategories, loadGoals } from '@/lib/queries'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const thisMonth = () => new Date().toISOString().slice(0, 7)

export default function BudgetsScreen() {
  const palette = usePalette()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session!.user.id
  const accountCreatedAt = session!.user.created_at ?? '2020-01-01'

  const [month, setMonth] = useState(thisMonth)
  const [addPickerOpen, setAddPickerOpen] = useState(false)

  const load = useCallback(async () => {
    const [budgets, categories, goals] = await Promise.all([
      loadBudgets(month, accountCreatedAt),
      loadCategories(),
      loadGoals(userId, month),
    ])
    return { ...budgets, categories, goals }
  }, [month, accountCreatedAt, userId])

  const { data, loading, refreshing, error, refresh } = useLoad(load, [userId, month])

  const groups = useMemo(() => {
    if (!data) return []
    const byGroup = new Map<string, BudgetWithSpend[]>()
    for (const b of data.budgets) {
      const group = b.category?.is_income ? 'Income' : (b.category?.group_name ?? 'Other')
      if (!byGroup.has(group)) byGroup.set(group, [])
      byGroup.get(group)!.push(b)
    }
    // Income first, then groups in category sort order (rows are pre-sorted)
    return [...byGroup.entries()].sort(([a], [b]) => {
      if (a === 'Income') return -1
      if (b === 'Income') return 1
      return 0
    })
  }, [data])

  if (loading || !data) return <LoadingView />

  const canGoBack = month > data.accountCreatedMonth
  const maxMonth = nextMonth(nextMonth(thisMonth())) // browse up to two months ahead
  const canGoForward = month < maxMonth

  const expenseBudgets = data.budgets.filter((b) => !b.category?.is_income)
  const totalBudgeted = expenseBudgets.reduce((s, b) => s + Number(b.amount), 0)
  const totalSpent = expenseBudgets.reduce((s, b) => s + b.spent, 0)
  const budgetedCategoryIds = new Set(data.budgets.map((b) => b.category_id))
  const unbudgeted = data.categories.filter(
    (c) => !budgetedCategoryIds.has(c.id) && !c.is_transfer
  )

  const isCurrentMonth = month === thisMonth()
  const expectedIncome = data.budgets
    .filter((b) => b.category?.is_income)
    .reduce((s, b) => s + Number(b.amount), 0)
  // Any goal with a monthly figure auto-claims room from this month's
  // expected savings, same as web's Budgets page — see lib/goal-math.ts.
  const liveAutoSave = isCurrentMonth
    ? liveGoalAutoSaveAmounts(data.goals, expectedIncome - totalBudgeted)
    : new Map<string, number>()
  const goalClaimed = data.goals.reduce(
    (s, g) => s + goalMonthAmount(g, isCurrentMonth, liveAutoSave),
    0
  )
  const goalPlanned = data.goals.reduce((s, g) => s + (goalMonthlyBudget(g) ?? 0), 0)
  // Active goals first; ones reached this cycle sink to the end — same
  // ordering as the web Budgets page and the mobile Goals tab.
  const sortedGoals = [...data.goals].sort((a, b) => {
    const aDone = Number(a.saved_amount) >= Number(a.target_amount) ? 1 : 0
    const bDone = Number(b.saved_amount) >= Number(b.target_amount) ? 1 : 0
    return aDone - bDone
  })

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <ErrorBanner message={error} />

      {/* Month navigation */}
      <View style={styles.monthNav}>
        <NavArrow symbol="chevron.left" enabled={canGoBack} onPress={() => setMonth(prevMonth(month))} />
        <Text style={[styles.monthLabel, { color: palette.text }]}>{monthName(month)}</Text>
        <NavArrow symbol="chevron.right" enabled={canGoForward} onPress={() => setMonth(nextMonth(month))} />
      </View>

      {data.budgets.length === 0 ? (
        <Card>
          <EmptyState
            symbol="chart.pie.fill"
            title="No budgets for this month"
            message="Set a monthly amount for a category and Fortuneer tracks your spending against it."
          />
        </Card>
      ) : (
        <>
          {/* Summary */}
          <Card>
            <View style={styles.summaryTop}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Spent</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>
                {formatCurrency(totalSpent)}{' '}
                <Text style={{ color: palette.muted, fontWeight: '400' }}>
                  of {formatCurrency(totalBudgeted)}
                </Text>
              </Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <ProgressBar
                ratio={totalBudgeted > 0 ? totalSpent / totalBudgeted : 0}
                color={totalSpent > totalBudgeted ? palette.danger : palette.accent}
                height={8}
              />
            </View>
            <Text style={[styles.summaryFoot, { color: palette.muted }]}>
              {totalSpent > totalBudgeted
                ? `${formatCurrency(totalSpent - totalBudgeted)} over budget`
                : `${formatCurrency(totalBudgeted - totalSpent)} left this month`}
              {data.income > 0 ? ` · ${formatCurrency(data.income)} income received` : ''}
            </Text>
          </Card>

          {/* Goals — mirrors web's Budgets page: each row is derived from a
              goal, not a real budget category. */}
          {data.goals.length > 0 && (
            <View>
              <SectionHeader
                title="Goals"
                action={
                  goalPlanned > 0 ? (
                    <Text style={[styles.groupTotal, { color: palette.muted }]}>
                      {formatCurrency(goalClaimed)} of {formatCurrency(goalPlanned)}/mo
                    </Text>
                  ) : undefined
                }
              />
              <View style={{ gap: 10 }}>
                {sortedGoals.map((g) => (
                  <GoalBudgetRow
                    key={g.id}
                    goal={g}
                    month={month}
                    liveAmount={
                      isCurrentMonth && liveAutoSave.has(g.id) ? liveAutoSave.get(g.id)! : null
                    }
                  />
                ))}
              </View>
            </View>
          )}

          {groups.map(([groupName, budgets]) => (
            <View key={groupName}>
              <SectionHeader
                title={groupName}
                action={
                  <Text style={[styles.groupTotal, { color: palette.muted }]}>
                    {formatCurrency(budgets.reduce((s, b) => s + b.spent, 0))} /{' '}
                    {formatCurrency(budgets.reduce((s, b) => s + Number(b.amount), 0))}
                  </Text>
                }
              />
              <Card>
                {budgets.map((b, i) => (
                  <View key={b.id}>
                    {i > 0 && <Separator inset={46} />}
                    <BudgetRow budget={b} month={month} />
                  </View>
                ))}
              </Card>
            </View>
          ))}
        </>
      )}

      <Pressable
        style={[styles.addButton, { backgroundColor: palette.accentSoft }]}
        onPress={() => setAddPickerOpen(true)}
      >
        <SymbolView name="plus" size={15} tintColor={palette.accent} />
        <Text style={{ color: palette.accent, fontSize: 15, fontWeight: '600' }}>
          Set a budget
        </Text>
      </Pressable>

      <PickerSheet
        title="Budget which category?"
        visible={addPickerOpen}
        options={unbudgeted.map((c) => ({
          key: c.id,
          label: c.name,
          sublabel: c.group_name,
          symbol: categorySymbol(c.icon),
          color: c.color ?? '#8E8E93',
        }))}
        selectedKey={null}
        onSelect={(key) => {
          if (key) router.push(`/budget-edit?categoryId=${key}&month=${month}`)
        }}
        onClose={() => setAddPickerOpen(false)}
      />
    </ScrollView>
  )
}

function NavArrow({
  symbol,
  enabled,
  onPress,
}: {
  symbol: 'chevron.left' | 'chevron.right'
  enabled: boolean
  onPress: () => void
}) {
  const palette = usePalette()
  // Disabled arrows keep their slot (muted) so the month label never shifts
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={10}
      style={[styles.navArrow, { backgroundColor: palette.inputBg }, !enabled && { opacity: 0.35 }]}
    >
      <SymbolView name={symbol} size={15} tintColor={palette.text} />
    </Pressable>
  )
}

function BudgetRow({ budget: b, month }: { budget: BudgetWithSpend; month: string }) {
  const palette = usePalette()
  const router = useRouter()
  const amount = Number(b.amount)
  const ratio = amount > 0 ? b.spent / amount : 0
  const isIncome = !!b.category?.is_income
  const over = !isIncome && b.spent > amount
  const color = over ? palette.danger : (b.category?.color ?? palette.accent)
  const remaining = amount - b.spent

  return (
    <Pressable
      style={({ pressed }) => [styles.budgetRow, pressed && { opacity: 0.55 }]}
      onPress={() => router.push(`/budget-edit?categoryId=${b.category_id}&month=${month}`)}
    >
      <SymbolChip symbol={categorySymbol(b.category?.icon)} color={b.category?.color ?? '#8E8E93'} />
      <View style={styles.budgetBody}>
        <View style={styles.budgetTop}>
          <Text style={[styles.budgetName, { color: palette.text }]} numberOfLines={1}>
            {b.category?.name ?? 'Category'}
          </Text>
          <Text style={[styles.budgetAmounts, { color: palette.muted }]}>
            <Text style={{ color: over ? palette.danger : palette.text, fontWeight: '600' }}>
              {formatCurrency(b.spent)}
            </Text>{' '}
            / {formatCurrency(amount)}
          </Text>
        </View>
        <View style={{ marginTop: 6 }}>
          <ProgressBar ratio={ratio} color={color} height={5} />
        </View>
        <Text style={[styles.budgetFoot, { color: over ? palette.danger : palette.faint }]}>
          {isIncome
            ? remaining > 0
              ? `${formatCurrency(remaining)} to go`
              : 'Target reached'
            : over
              ? `${formatCurrency(b.spent - amount)} over`
              : `${formatCurrency(remaining)} left`}
        </Text>
      </View>
    </Pressable>
  )
}

/** A goal's row in the Budgets screen — mirrors web's GoalBudgetRow. Taps
 *  through to /goal-allocate to set this month's (or an ongoing) plan;
 *  liveAmount is this month's auto-save claim (see lib/goal-math.ts), which
 *  is what the row shows and edits in preference to the abstract plan. */
function GoalBudgetRow({
  goal,
  month,
  liveAmount,
}: {
  goal: Goal
  month: string
  liveAmount: number | null
}) {
  const palette = usePalette()
  const router = useRouter()
  const saved = Number(goal.saved_amount)
  const target = Number(goal.target_amount)
  const overallDone = saved >= target
  const plan = goalMonthlyBudget(goal)
  const budgeted = liveAmount ?? plan
  const color = goal.color ?? palette.accent
  const isClamped = liveAmount != null && plan != null && liveAmount < plan
  const ratio = overallDone ? 1 : target > 0 ? saved / target : 0

  let statusLine: string
  if (overallDone) {
    statusLine = 'Goal reached 🎉'
  } else if (budgeted == null) {
    statusLine = 'No monthly plan'
  } else if (budgeted === 0) {
    statusLine = isClamped ? 'No budget room left this month' : 'Contributions paused'
  } else {
    const projected = projectedFinishMonth(target, saved, budgeted)
    if (goal.target_date) {
      statusLine = `On track for ${monthName(goal.target_date.slice(0, 7))}`
      if (projected && projected !== goal.target_date.slice(0, 7)) {
        statusLine += ` · done ~${monthName(projected)}`
      }
    } else if (projected) {
      statusLine = `Done ~${monthName(projected)}`
    } else {
      statusLine = 'In progress'
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [pressed && !overallDone && { opacity: 0.55 }]}
      onPress={() => router.push(`/goal-allocate?id=${goal.id}&month=${month}`)}
      disabled={overallDone}
    >
      <Card style={[styles.goalCard, { borderLeftColor: color, backgroundColor: `${color}12` }]}>
        <View style={styles.budgetRow}>
          <SymbolChip symbol={categorySymbol(goal.icon)} color={color} />
          <View style={styles.budgetBody}>
            <View style={styles.budgetTop}>
              <Text style={[styles.budgetName, { color: palette.text }]} numberOfLines={1}>
                {goal.name}
              </Text>
              {!overallDone && (
                <Text style={styles.budgetAmounts}>
                  <Text style={{ color, fontWeight: '600' }}>
                    {budgeted != null ? formatCurrency(budgeted) : 'Set plan'}
                  </Text>
                  {budgeted != null && (
                    <Text style={{ color: palette.muted }}>/mo</Text>
                  )}
                </Text>
              )}
            </View>
            <View style={{ marginTop: 6 }}>
              <ProgressBar ratio={ratio} color={color} height={5} />
            </View>
            <Text style={[styles.budgetFoot, { color: palette.faint }]}>
              {statusLine} · {formatCurrency(saved)} of {formatCurrency(target)} saved
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  goalCard: { borderLeftWidth: 4 },
  content: { padding: 16, paddingBottom: 40 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthLabel: { fontSize: 20, fontWeight: '700' },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  summaryLabel: { fontSize: 13, fontWeight: '500' },
  summaryValue: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryFoot: { fontSize: 12, marginTop: 8 },
  groupTotal: { fontSize: 12, fontVariant: ['tabular-nums'] },
  budgetRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  budgetBody: { flex: 1, minWidth: 0 },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  budgetName: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  budgetAmounts: { fontSize: 13, fontVariant: ['tabular-nums'] },
  budgetFoot: { fontSize: 11, marginTop: 4 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 20,
  },
})
