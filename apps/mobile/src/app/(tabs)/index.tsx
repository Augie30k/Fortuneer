import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { formatCurrency, type Account } from '@fortuneer/shared'

import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

// Same money convention as the web app: credit/loan balances are liabilities
// and subtract from net worth.
const LIABILITY_TYPES = new Set(['credit', 'loan'])

export default function DashboardScreen() {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('hidden', false)
      .order('balance', { ascending: false })
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setAccounts((data ?? []) as Account[])
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

  const netWorth = accounts.reduce(
    (sum, a) => sum + (LIABILITY_TYPES.has(a.type) ? -a.balance : a.balance),
    0
  )

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={accounts}
      keyExtractor={(a) => a.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.caption}>Signed in as {session?.user.email}</Text>
          <Text style={styles.caption}>Net worth</Text>
          <Text style={styles.netWorth}>{formatCurrency(netWorth)}</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.meta}>
              {item.type}
              {item.mask ? ` ••${item.mask}` : ''}
            </Text>
          </View>
          <Text style={styles.balance}>
            {formatCurrency(LIABILITY_TYPES.has(item.type) ? -item.balance : item.balance)}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>No accounts yet — connect one on the web app.</Text>
      }
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 16 },
  caption: { fontSize: 13, color: '#8a8a8e', marginBottom: 2 },
  netWorth: { fontSize: 34, fontWeight: '700', color: '#e5e5ea' },
  signOut: { color: '#ff453a', fontSize: 14, marginTop: 10 },
  error: { color: '#ff453a', fontSize: 13, marginTop: 6 },
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
  balance: { fontSize: 16, fontWeight: '600', color: '#e5e5ea' },
  empty: { color: '#8a8a8e', textAlign: 'center', marginTop: 40 },
})
