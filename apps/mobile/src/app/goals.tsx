import { useCallback } from 'react'
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
  formatDate,
  goalMonthlyBudget,
  monthName,
  projectedFinishMonth,
  type Goal,
} from '@fortuneer/shared'

import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingView,
  ProgressBar,
  SymbolChip,
} from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { categorySymbol } from '@/lib/category-icons'
import { loadGoals } from '@/lib/queries'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

export default function GoalsScreen() {
  const palette = usePalette()
  const { session } = useAuth()
  const userId = session!.user.id

  const load = useCallback(
    () => loadGoals(userId, new Date().toISOString().slice(0, 7)),
    [userId]
  )
  const { data: goals, loading, refreshing, error, refresh } = useLoad(load, [userId])

  if (loading || !goals) return <LoadingView />

  const totalSaved = goals.reduce((s, g) => s + Number(g.saved_amount), 0)
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0)

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <ErrorBanner message={error} />

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            symbol="target"
            title="No goals yet"
            message="Create a savings goal on the web app — track progress and add money from here."
          />
        </Card>
      ) : (
        <>
          <Text style={[styles.caption, { color: palette.muted }]}>TOTAL SAVED</Text>
          <Text style={[styles.total, { color: palette.text }]}>
            {formatCurrency(totalSaved)}{' '}
            <Text style={[styles.totalTarget, { color: palette.muted }]}>
              of {formatCurrency(totalTarget)}
            </Text>
          </Text>

          <View style={{ gap: 12, marginTop: 16 }}>
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </View>

          <Text style={[styles.footnote, { color: palette.faint }]}>
            Create, edit, and prioritize goals on the web app.
          </Text>
        </>
      )}
    </ScrollView>
  )
}

function GoalCard({ goal: g }: { goal: Goal }) {
  const palette = usePalette()
  const router = useRouter()
  const saved = Number(g.saved_amount)
  const target = Number(g.target_amount)
  const ratio = target > 0 ? Math.min(1, saved / target) : 0
  const color = g.color ?? palette.accent
  const reached = saved >= target
  const monthly = goalMonthlyBudget(g)
  const contributed = Math.max(0, Number(g.contributions_this_month ?? 0))

  const projection = reached
    ? 'Goal reached 🎉'
    : g.target_date
      ? `Target ${formatDate(g.target_date, { month: 'short', year: 'numeric' })}`
      : monthly != null
        ? (() => {
            const finish = projectedFinishMonth(target, saved, monthly)
            return finish ? `On pace for ${monthName(finish)}` : null
          })()
        : 'Flexible — save when you can'

  return (
    <Card>
      <View style={styles.goalHeader}>
        <SymbolChip symbol={categorySymbol(g.icon)} color={color} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.goalName, { color: palette.text }]} numberOfLines={1}>
            {g.name}
          </Text>
          {projection ? (
            <Text style={[styles.goalMeta, { color: palette.muted }]} numberOfLines={1}>
              {projection}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.goalPct, { color }]}>{Math.round(ratio * 100)}%</Text>
      </View>

      <View style={{ marginTop: 12 }}>
        <ProgressBar ratio={ratio} color={color} height={8} />
      </View>
      <View style={styles.goalAmounts}>
        <Text style={[styles.goalSaved, { color: palette.text }]}>
          {formatCurrency(saved)}
          <Text style={{ color: palette.muted, fontWeight: '400' }}>
            {' '}
            of {formatCurrency(target)}
          </Text>
        </Text>
        {monthly != null && !reached ? (
          <Text style={[styles.goalMonthly, { color: palette.muted }]}>
            {formatCurrency(contributed)} / {formatCurrency(monthly)} this month
          </Text>
        ) : null}
      </View>

      <View style={styles.goalActions}>
        <GoalAction
          label="Add money"
          symbol="plus.circle.fill"
          color={palette.accent}
          onPress={() => router.push(`/goal-contribute?id=${g.id}&mode=add`)}
        />
        <GoalAction
          label="Withdraw"
          symbol="minus.circle"
          color={palette.muted}
          onPress={() => router.push(`/goal-contribute?id=${g.id}&mode=withdraw`)}
          disabled={saved <= 0}
        />
      </View>
    </Card>
  )
}

function GoalAction({
  label,
  symbol,
  color,
  onPress,
  disabled = false,
}: {
  label: string
  symbol: 'plus.circle.fill' | 'minus.circle'
  color: string
  onPress: () => void
  disabled?: boolean
}) {
  const palette = usePalette()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.goalAction,
        { backgroundColor: palette.inputBg },
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      <SymbolView name={symbol} size={15} tintColor={color} />
      <Text style={{ color, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  total: { fontSize: 30, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  totalTarget: { fontSize: 17, fontWeight: '500' },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalName: { fontSize: 16, fontWeight: '600' },
  goalMeta: { fontSize: 12, marginTop: 2 },
  goalPct: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  goalAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
    gap: 8,
  },
  goalSaved: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  goalMonthly: { fontSize: 12, fontVariant: ['tabular-nums'] },
  goalActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  goalAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
  },
  footnote: { fontSize: 12, textAlign: 'center', marginTop: 24 },
})
