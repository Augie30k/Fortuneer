import { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import {
  formatCurrency,
  goalMonthlyBudget,
  monthName,
  setGoalAllocation,
  setGoalAllocationUntil,
  type Goal,
} from '@fortuneer/shared'

import { Card, ErrorBanner, LoadingView, PrimaryButton, SectionHeader, SymbolChip } from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { categorySymbol } from '@/lib/category-icons'
import { loadGoals } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

type Scope = 'month' | 'onward' | 'until_target'

/** Set a goal's monthly savings plan for `month` — mirrors budget-edit.tsx's
 *  scope choice, plus an "until target date" option (setGoalAllocationUntil)
 *  matching web's Budgets page popover exactly. */
export default function GoalAllocateScreen() {
  const { id, month } = useLocalSearchParams<{ id: string; month: string }>()
  const palette = usePalette()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session!.user.id

  const load = useCallback(async () => {
    const goals = await loadGoals(userId, month)
    const goal = goals.find((g) => g.id === id)
    if (!goal) throw new Error('Goal not found')
    return goal as Goal
  }, [userId, month, id])

  const { data: goal, loading, error: loadError } = useLoad(load, [userId, month, id], {
    refetchOnFocus: false,
  })

  const [amountText, setAmountText] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('month')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading || !goal) return <LoadingView />

  const currentPlan = goalMonthlyBudget(goal)
  const color = goal.color ?? palette.accent
  const text = amountText ?? (currentPlan != null ? currentPlan.toFixed(2) : '')
  const value = parseFloat(text)
  const canSave = Number.isFinite(value) && value >= 0 && !saving

  const write = async (amount: number) => {
    setError(null)
    setSaving(true)
    try {
      if (scope === 'until_target' && goal.target_date) {
        await setGoalAllocationUntil(supabase, userId, goal.id, amount, month, goal.target_date.slice(0, 7))
      } else {
        await setGoalAllocation(supabase, userId, goal.id, amount, month, scope === 'onward')
      }
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plan')
      setSaving(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: goal.name }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ErrorBanner message={error ?? loadError} />

          <View style={styles.goalHeader}>
            <SymbolChip symbol={categorySymbol(goal.icon)} color={color} size={44} />
            <View>
              <Text style={[styles.goalName, { color: palette.text }]}>{goal.name}</Text>
              <Text style={[styles.goalMeta, { color: palette.muted }]}>
                {currentPlan != null
                  ? `Currently ${formatCurrency(currentPlan)}/mo · ${monthName(month)}`
                  : `No monthly plan · ${monthName(month)}`}
              </Text>
            </View>
          </View>

          <SectionHeader title="Monthly amount" />
          <Card>
            <View style={styles.amountRow}>
              <Text style={[styles.currency, { color: palette.muted }]}>$</Text>
              <TextInput
                style={[styles.amountInput, { color: palette.text }]}
                value={text}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={palette.faint}
                autoFocus
              />
            </View>
          </Card>

          <SectionHeader title="Applies to" />
          <Card style={{ gap: 4 }}>
            <ScopeOption
              title={`${monthName(month)} only`}
              subtitle="Other months keep their current plan."
              selected={scope === 'month'}
              onPress={() => setScope('month')}
            />
            <ScopeOption
              title="Every month"
              subtitle={`Applies from ${monthName(month)} forward until you change it.`}
              selected={scope === 'onward'}
              onPress={() => setScope('onward')}
            />
            {goal.target_date && (
              <ScopeOption
                title={`Every month until ${monthName(goal.target_date.slice(0, 7))}`}
                subtitle="Stops automatically after the goal's target date."
                selected={scope === 'until_target'}
                onPress={() => setScope('until_target')}
              />
            )}
          </Card>

          <View style={{ marginTop: 20 }}>
            <PrimaryButton
              title="Save plan"
              onPress={() => write(value)}
              disabled={!canSave}
              loading={saving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

function ScopeOption({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string
  subtitle: string
  selected: boolean
  onPress: () => void
}) {
  const palette = usePalette()
  return (
    <Pressable onPress={onPress} style={styles.scopeRow}>
      <SymbolView
        name={selected ? 'largecircle.fill.circle' : 'circle'}
        size={20}
        tintColor={selected ? palette.accent : palette.faint}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.scopeTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.scopeSub, { color: palette.muted }]}>{subtitle}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalName: { fontSize: 19, fontWeight: '700' },
  goalMeta: { fontSize: 13, marginTop: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currency: { fontSize: 28, fontWeight: '600' },
  amountInput: { flex: 1, fontSize: 34, fontWeight: '700', padding: 0 },
  scopeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  scopeTitle: { fontSize: 15, fontWeight: '500' },
  scopeSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
})
