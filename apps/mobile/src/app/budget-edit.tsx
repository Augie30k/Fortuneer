import { useCallback, useState } from 'react'
import {
  Alert,
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
  effectiveBudgetsForMonth,
  formatCurrency,
  monthName,
  setBudgetAmount,
  type Category,
} from '@fortuneer/shared'

import { Card, ErrorBanner, LoadingView, PrimaryButton, SectionHeader, SymbolChip } from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { categorySymbol } from '@/lib/category-icons'
import { supabase } from '@/lib/supabase'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

type Scope = 'month' | 'onward'

/** Set or change one category's budget for a month. Single-month by default —
 *  carrying the amount into all upcoming months is an explicit choice. */
export default function BudgetEditScreen() {
  const { categoryId, month } = useLocalSearchParams<{ categoryId: string; month: string }>()
  const palette = usePalette()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session!.user.id

  const load = useCallback(async () => {
    const [categoryRes, budgetsRes] = await Promise.all([
      supabase.from('categories').select('*').eq('id', categoryId).single(),
      supabase.from('budgets').select('*').eq('category_id', categoryId).lte('month', `${month}-01`),
    ])
    if (categoryRes.error) throw categoryRes.error
    if (budgetsRes.error) throw budgetsRes.error
    const effective = effectiveBudgetsForMonth(budgetsRes.data ?? [], month)
    return {
      category: categoryRes.data as Category,
      currentAmount: effective.length > 0 ? Number(effective[0].amount) : 0,
    }
  }, [categoryId, month])

  const { data, loading, error: loadError } = useLoad(load, [categoryId, month], {
    refetchOnFocus: false,
  })

  const [amountText, setAmountText] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('month')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading || !data) return <LoadingView />

  const { category, currentAmount } = data
  const text = amountText ?? (currentAmount > 0 ? currentAmount.toFixed(2) : '')
  const value = parseFloat(text)
  const canSave = Number.isFinite(value) && value >= 0 && !saving

  const write = async (amount: number) => {
    setError(null)
    setSaving(true)
    try {
      await setBudgetAmount(supabase, userId, categoryId, amount, month, scope === 'onward')
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save budget')
      setSaving(false)
    }
  }

  const confirmRemove = () => {
    Alert.alert(
      scope === 'onward' ? 'Remove budget from here on?' : `Remove budget for ${monthName(month)}?`,
      scope === 'onward'
        ? `${category.name} stops being budgeted starting ${monthName(month)}.`
        : `${category.name} keeps its budget in other months.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => write(0) },
      ]
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: category.name }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ErrorBanner message={error ?? loadError} />

          <View style={styles.categoryHeader}>
            <SymbolChip
              symbol={categorySymbol(category.icon)}
              color={category.color ?? '#8E8E93'}
              size={44}
            />
            <View>
              <Text style={[styles.categoryName, { color: palette.text }]}>{category.name}</Text>
              <Text style={[styles.categoryMeta, { color: palette.muted }]}>
                {currentAmount > 0
                  ? `Currently ${formatCurrency(currentAmount)} · ${monthName(month)}`
                  : `Not budgeted · ${monthName(month)}`}
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
              subtitle="Other months keep their current budget."
              selected={scope === 'month'}
              onPress={() => setScope('month')}
            />
            <ScopeOption
              title="All upcoming months"
              subtitle={`Applies from ${monthName(month)} forward until you change it.`}
              selected={scope === 'onward'}
              onPress={() => setScope('onward')}
            />
          </Card>

          <View style={{ marginTop: 20, gap: 10 }}>
            <PrimaryButton
              title="Save budget"
              onPress={() => write(value)}
              disabled={!canSave}
              loading={saving}
            />
            {currentAmount > 0 && (
              <PrimaryButton title="Remove budget" onPress={confirmRemove} destructive />
            )}
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
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryName: { fontSize: 19, fontWeight: '700' },
  categoryMeta: { fontSize: 13, marginTop: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currency: { fontSize: 28, fontWeight: '600' },
  amountInput: { flex: 1, fontSize: 34, fontWeight: '700', padding: 0 },
  scopeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  scopeTitle: { fontSize: 15, fontWeight: '500' },
  scopeSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
})
