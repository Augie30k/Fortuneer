import { useMemo, useState } from 'react'
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
import { useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'

import PickerSheet from '@/components/PickerSheet'
import { Card, ErrorBanner, Pills, PrimaryButton, SectionHeader } from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { categorySymbol } from '@/lib/category-icons'
import { loadAccounts, loadCategories } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

export default function NewTransactionScreen() {
  const palette = usePalette()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session!.user.id

  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [amountText, setAmountText] = useState('')
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10))
  const [picker, setPicker] = useState<'category' | 'account' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data } = useLoad(
    async () => {
      const [categories, accounts] = await Promise.all([loadCategories(), loadAccounts(userId)])
      return { categories, accounts }
    },
    [userId],
    { refetchOnFocus: false }
  )
  const categories = useMemo(
    () => (data?.categories ?? []).filter((c) => (kind === 'income' ? c.is_income : !c.is_income)),
    [data?.categories, kind]
  )
  const accounts = (data?.accounts ?? []).filter((a) => !a.hidden)

  const category = categories.find((c) => c.id === categoryId)
  const account = accounts.find((a) => a.id === accountId)

  const value = parseFloat(amountText)
  const canSave =
    Number.isFinite(value) &&
    value > 0 &&
    description.trim().length > 0 &&
    !!accountId &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateText) &&
    !saving

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      // Plaid sign convention (same as web): outflow positive, income negative
      const amount = kind === 'income' ? -Math.abs(value) : Math.abs(value)
      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: userId,
        account_id: accountId,
        description: description.trim(),
        amount,
        date: dateText,
        category_id: categoryId,
      })
      if (insertError) throw insertError
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add transaction')
      setSaving(false)
    }
  }

  const inputStyle = [styles.input, { color: palette.text, backgroundColor: palette.inputBg }]

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />

        <Pills
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
          value={kind}
          onChange={(next) => {
            setKind(next)
            setCategoryId(null)
          }}
        />

        <SectionHeader title="Amount" />
        <Card>
          <View style={styles.amountRow}>
            <Text style={[styles.currency, { color: palette.muted }]}>$</Text>
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

        <SectionHeader title="Details" />
        <Card style={{ gap: 10 }}>
          <Field label="Vendor">
            <TextInput
              style={inputStyle}
              value={description}
              onChangeText={setDescription}
              placeholder={kind === 'income' ? 'e.g. Paycheck, Refund' : 'e.g. Farmers market'}
              placeholderTextColor={palette.muted}
            />
          </Field>
          <Field label="Account">
            <Pressable
              style={[styles.pickerButton, { backgroundColor: palette.inputBg }]}
              onPress={() => setPicker('account')}
            >
              <Text style={{ color: account ? palette.text : palette.muted, fontSize: 15 }}>
                {account?.name ?? 'Choose'}
              </Text>
              <SymbolView name="chevron.up.chevron.down" size={13} tintColor={palette.faint} />
            </Pressable>
          </Field>
          <Field label="Category (optional)">
            <Pressable
              style={[styles.pickerButton, { backgroundColor: palette.inputBg }]}
              onPress={() => setPicker('category')}
            >
              {category ? (
                <View style={styles.pickerValue}>
                  <SymbolView
                    name={categorySymbol(category.icon)}
                    size={16}
                    tintColor={category.color ?? palette.muted}
                  />
                  <Text style={{ color: palette.text, fontSize: 15 }}>{category.name}</Text>
                </View>
              ) : (
                <Text style={{ color: palette.muted, fontSize: 15 }}>Optional</Text>
              )}
              <SymbolView name="chevron.up.chevron.down" size={13} tintColor={palette.faint} />
            </Pressable>
          </Field>
          <Field label="Date (YYYY-MM-DD)">
            <TextInput
              style={inputStyle}
              value={dateText}
              onChangeText={setDateText}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </Field>
        </Card>

        <View style={{ marginTop: 20 }}>
          <PrimaryButton
            title={kind === 'income' ? 'Add income' : 'Add expense'}
            onPress={save}
            disabled={!canSave}
            loading={saving}
          />
        </View>
      </ScrollView>

      <PickerSheet
        title="Category"
        visible={picker === 'category'}
        options={categories.map((c) => ({
          key: c.id,
          label: c.name,
          sublabel: c.group_name,
          symbol: categorySymbol(c.icon),
          color: c.color ?? '#8E8E93',
        }))}
        selectedKey={categoryId}
        onSelect={setCategoryId}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        title="Account"
        visible={picker === 'account'}
        options={accounts.map((a) => ({
          key: a.id,
          label: a.name,
          sublabel: a.plaid_items?.institution_name ?? (a.is_manual ? 'Manual' : undefined),
        }))}
        selectedKey={accountId}
        onSelect={setAccountId}
        onClose={() => setPicker(null)}
      />
    </KeyboardAvoidingView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const palette = usePalette()
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: palette.muted }]}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currency: { fontSize: 28, fontWeight: '600' },
  amountInput: { flex: 1, fontSize: 34, fontWeight: '700', padding: 0 },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 5 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  pickerValue: { flexDirection: 'row', alignItems: 'center', gap: 7 },
})
