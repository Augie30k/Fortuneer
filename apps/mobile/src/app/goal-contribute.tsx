import { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import {
  formatCurrency,
  recordGoalContribution,
  type Goal,
} from '@fortuneer/shared'

import { Card, ErrorBanner, LoadingView, PrimaryButton, ProgressBar, SymbolChip } from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { categorySymbol } from '@/lib/category-icons'
import { supabase } from '@/lib/supabase'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

export default function GoalContributeScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>()
  const withdraw = mode === 'withdraw'
  const palette = usePalette()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session!.user.id

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('goals').select('*').eq('id', id).single()
    if (error) throw error
    return data as Goal
  }, [id])
  const { data: goal, loading, error: loadError } = useLoad(load, [id], { refetchOnFocus: false })

  const [amountText, setAmountText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading || !goal) return <LoadingView />

  const saved = Number(goal.saved_amount)
  const target = Number(goal.target_amount)
  const color = goal.color ?? palette.accent
  const value = parseFloat(amountText)
  const maxWithdraw = saved
  const canSave =
    Number.isFinite(value) && value > 0 && (!withdraw || value <= maxWithdraw) && !saving

  const preview = Number.isFinite(value) && value > 0
    ? Math.max(0, saved + (withdraw ? -value : value))
    : saved

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      await recordGoalContribution(supabase, userId, goal.id, withdraw ? -value : value)
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: withdraw ? 'Withdraw' : 'Add money' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ErrorBanner message={error ?? loadError} />

          <View style={styles.goalHeader}>
            <SymbolChip symbol={categorySymbol(goal.icon)} color={color} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.goalName, { color: palette.text }]} numberOfLines={1}>
                {goal.name}
              </Text>
              <Text style={[styles.goalMeta, { color: palette.muted }]}>
                {formatCurrency(saved)} of {formatCurrency(target)} saved
              </Text>
            </View>
          </View>

          <Card style={{ marginTop: 16 }}>
            <View style={styles.amountRow}>
              <Text style={[styles.currency, { color: palette.muted }]}>
                {withdraw ? '−$' : '+$'}
              </Text>
              <TextInput
                style={[styles.amountInput, { color: palette.text }]}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={palette.faint}
                autoFocus
              />
            </View>
          </Card>

          {withdraw && Number.isFinite(value) && value > maxWithdraw ? (
            <Text style={[styles.warn, { color: palette.danger }]}>
              You can withdraw at most {formatCurrency(maxWithdraw)}.
            </Text>
          ) : (
            <Text style={[styles.warn, { color: 'transparent' }]}> </Text>
          )}

          {/* Live preview of where the goal lands */}
          <Card style={{ marginTop: 4 }}>
            <Text style={[styles.previewLabel, { color: palette.muted }]}>After this change</Text>
            <Text style={[styles.previewValue, { color: palette.text }]}>
              {formatCurrency(preview)}
              <Text style={{ color: palette.muted, fontWeight: '400' }}>
                {' '}
                of {formatCurrency(target)}
              </Text>
            </Text>
            <View style={{ marginTop: 8 }}>
              <ProgressBar ratio={target > 0 ? preview / target : 0} color={color} height={7} />
            </View>
          </Card>

          <View style={{ marginTop: 20 }}>
            <PrimaryButton
              title={withdraw ? 'Withdraw from goal' : 'Add to goal'}
              onPress={save}
              disabled={!canSave}
              loading={saving}
              destructive={withdraw}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
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
  warn: { fontSize: 12, marginTop: 8, marginBottom: 4, paddingHorizontal: 4 },
  previewLabel: { fontSize: 12, fontWeight: '500' },
  previewValue: { fontSize: 17, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] },
})
