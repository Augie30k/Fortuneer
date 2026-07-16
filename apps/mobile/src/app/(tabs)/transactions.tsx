import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { formatCurrency, type Transaction } from '@fortuneer/shared'

import { supabase } from '@/lib/supabase'
import { usePalette } from '@/lib/theme'

export default function TransactionsScreen() {
  const palette = usePalette()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .limit(50)
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setTransactions((data ?? []) as Transaction[])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={transactions}
      keyExtractor={(t) => t.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null
      }
      renderItem={({ item }) => {
        // Plaid convention (same as web): amount > 0 is money OUT.
        const isInflow = item.amount < 0
        return (
          <View style={[styles.row, { borderBottomColor: palette.hairline }]}>
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                {item.merchant_name ?? item.description}
              </Text>
              <Text style={[styles.meta, { color: palette.muted }]}>
                {item.date}
                {item.pending ? ' · pending' : ''}
              </Text>
            </View>
            <Text
              style={[styles.amount, { color: isInflow ? palette.positive : palette.text }]}
            >
              {isInflow ? `+${formatCurrency(-item.amount)}` : formatCurrency(item.amount)}
            </Text>
          </View>
        )
      }}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: palette.muted }]}>No transactions yet.</Text>
      }
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  error: { fontSize: 13, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, marginRight: 12 },
  name: { fontSize: 16 },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40 },
})
