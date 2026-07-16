import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { formatCurrency, type Transaction } from '@fortuneer/shared'

import { supabase } from '@/lib/supabase'

export default function TransactionsScreen() {
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
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      renderItem={({ item }) => {
        // Plaid convention (same as web): amount > 0 is money OUT.
        const isInflow = item.amount < 0
        return (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.merchant_name ?? item.description}
              </Text>
              <Text style={styles.meta}>
                {item.date}
                {item.pending ? ' · pending' : ''}
              </Text>
            </View>
            <Text style={[styles.amount, isInflow && styles.inflow]}>
              {isInflow ? `+${formatCurrency(-item.amount)}` : formatCurrency(item.amount)}
            </Text>
          </View>
        )
      }}
      ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  error: { color: '#ff453a', fontSize: 13, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120,120,128,0.3)',
  },
  rowText: { flex: 1, marginRight: 12 },
  name: { fontSize: 16, color: '#e5e5ea' },
  meta: { fontSize: 12, color: '#8a8a8e', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '600', color: '#e5e5ea' },
  inflow: { color: '#30d158' },
  empty: { color: '#8a8a8e', textAlign: 'center', marginTop: 40 },
})
