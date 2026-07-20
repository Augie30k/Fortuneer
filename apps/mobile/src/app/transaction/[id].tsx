import { useCallback, useEffect, useState } from 'react'
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
  formatSignedAmount,
  type AccountWithItem,
  type Category,
  type TransactionWithRefs,
} from '@fortuneer/shared'

import PickerSheet from '@/components/PickerSheet'
import { AppIcon, Card, ErrorBanner, LoadingView, PrimaryButton, SectionHeader, Separator } from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { categorySymbol } from '@/lib/category-icons'
import { loadAccounts, loadCategories } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const palette = usePalette()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session!.user.id

  const load = useCallback(async () => {
    const [txnRes, categories, accounts] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, accounts(name, mask), categories(name, icon, color, is_income, is_transfer)')
        .eq('id', id)
        .single(),
      loadCategories(),
      loadAccounts(userId),
    ])
    if (txnRes.error) throw txnRes.error
    return { txn: txnRes.data as TransactionWithRefs, categories, accounts }
  }, [id, userId])

  const { data, loading, error } = useLoad(load, [id], { refetchOnFocus: false })

  if (loading || !data) return <LoadingView />
  return <TransactionForm {...data} onDone={() => router.back()} loadError={error} />
}

function TransactionForm({
  txn,
  categories,
  accounts,
  onDone,
  loadError,
}: {
  txn: TransactionWithRefs
  categories: Category[]
  accounts: AccountWithItem[]
  onDone: () => void
  loadError: string | null
}) {
  const palette = usePalette()
  const isManual = txn.plaid_transaction_id === null
  const isInflow = txn.amount < 0

  const [description, setDescription] = useState(txn.description)
  const [merchantName, setMerchantName] = useState(txn.merchant_name ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(txn.category_id)
  const [notes, setNotes] = useState(txn.notes ?? '')
  const [amountText, setAmountText] = useState(Math.abs(txn.amount).toFixed(2))
  const [dateText, setDateText] = useState(txn.date)
  const [accountId, setAccountId] = useState(txn.account_id)
  const [picker, setPicker] = useState<'category' | 'account' | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(loadError)
  useEffect(() => setError(loadError), [loadError])

  const category = categories.find((c) => c.id === categoryId)
  const account = accounts.find((a) => a.id === accountId)

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      // Same field rules as web PATCH /api/transactions/[id]: amount, date,
      // and account come from the bank on synced transactions — only manual
      // entries can change them.
      const updates: Record<string, unknown> = {
        category_id: categoryId,
        notes: notes.trim() || null,
        merchant_name: merchantName.trim() || null,
      }
      if (description.trim()) updates.description = description.trim()
      if (isManual) {
        const value = parseFloat(amountText)
        if (Number.isFinite(value) && value > 0) {
          updates.amount = isInflow ? -value : value
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) updates.date = dateText
        updates.account_id = accountId
      }
      const { error: updateError } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', txn.id)
      if (updateError) throw updateError
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save changes')
      setSaving(false)
    }
  }

  const confirmDelete = () => {
    Alert.alert(
      'Delete this transaction?',
      'This removes it from all totals and reports. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            const { error: deleteError } = await supabase
              .from('transactions')
              .delete()
              .eq('id', txn.id)
            if (deleteError) {
              setError(deleteError.message)
              setDeleting(false)
            } else {
              onDone()
            }
          },
        },
      ]
    )
  }

  const inputStyle = [
    styles.input,
    { color: palette.text, backgroundColor: palette.inputBg },
  ]

  return (
    <>
      <Stack.Screen options={{ title: txn.merchant_name ?? txn.description }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ErrorBanner message={error} />

          {/* Amount hero */}
          <Text
            style={[
              styles.amount,
              { color: isInflow ? palette.positive : palette.text },
            ]}
          >
            {formatSignedAmount(txn.amount)}
          </Text>
          <Text style={[styles.meta, { color: palette.muted }]}>
            {txn.date}
            {txn.pending ? ' · Pending' : ''}
            {!isManual && txn.accounts ? ` · ${txn.accounts.name}` : ''}
          </Text>

          <SectionHeader title="Details" />
          <Card style={{ gap: 10 }}>
            <Field label="Vendor">
              <TextInput
                style={inputStyle}
                value={description}
                onChangeText={setDescription}
                placeholder="Vendor"
                placeholderTextColor={palette.muted}
              />
            </Field>
            <Field label="Display name (optional, shown in lists)">
              <TextInput
                style={inputStyle}
                value={merchantName}
                onChangeText={setMerchantName}
                placeholder="e.g. Starbucks"
                placeholderTextColor={palette.muted}
              />
            </Field>
            <Field label="Category">
              <Pressable
                style={[styles.pickerButton, { backgroundColor: palette.inputBg }]}
                onPress={() => setPicker('category')}
              >
                {category ? (
                  <View style={styles.pickerValue}>
                    <AppIcon
                      icon={categorySymbol(category.icon)}
                      size={16}
                      color={category.color ?? palette.muted}
                    />
                    <Text style={{ color: palette.text, fontSize: 15 }}>{category.name}</Text>
                  </View>
                ) : (
                  <Text style={{ color: palette.muted, fontSize: 15 }}>Choose a category</Text>
                )}
                <SymbolView name="chevron.up.chevron.down" size={13} tintColor={palette.faint} />
              </Pressable>
            </Field>
            <Field label="Notes">
              <TextInput
                style={[...inputStyle, styles.notes]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add a note…"
                placeholderTextColor={palette.muted}
                multiline
              />
            </Field>
          </Card>

          {isManual && (
            <>
              <SectionHeader title="Manual entry" />
              <Card style={{ gap: 10 }}>
                <Field label="Amount">
                  <TextInput
                    style={inputStyle}
                    value={amountText}
                    onChangeText={setAmountText}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={palette.muted}
                  />
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
                <Field label="Account">
                  <Pressable
                    style={[styles.pickerButton, { backgroundColor: palette.inputBg }]}
                    onPress={() => setPicker('account')}
                  >
                    <Text style={{ color: account ? palette.text : palette.muted, fontSize: 15 }}>
                      {account?.name ?? 'Choose an account'}
                    </Text>
                    <SymbolView name="chevron.up.chevron.down" size={13} tintColor={palette.faint} />
                  </Pressable>
                </Field>
              </Card>
            </>
          )}

          <View style={{ marginTop: 20, gap: 10 }}>
            <PrimaryButton title="Save changes" onPress={save} loading={saving} />
            {isManual && (
              <PrimaryButton
                title="Delete transaction"
                onPress={confirmDelete}
                loading={deleting}
                destructive
              />
            )}
          </View>
          <Separator inset={0} />
        </ScrollView>
      </KeyboardAvoidingView>

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
        options={accounts
          .filter((a) => !a.hidden)
          .map((a) => ({
            key: a.id,
            label: a.name,
            sublabel: a.plaid_items?.institution_name ?? (a.is_manual ? 'Manual' : undefined),
          }))}
        selectedKey={accountId}
        onSelect={(key) => key && setAccountId(key)}
        onClose={() => setPicker(null)}
      />
    </>
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
  amount: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  meta: { fontSize: 13, marginTop: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 5 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  notes: { minHeight: 64, textAlignVertical: 'top' },
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
