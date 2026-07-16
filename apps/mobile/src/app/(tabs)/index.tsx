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
import { usePalette } from '@/lib/theme'

// Same money convention as the web app: credit/loan balances are liabilities
// and subtract from net worth.
const LIABILITY_TYPES = new Set(['credit', 'loan'])

export default function DashboardScreen() {
  const { session } = useAuth()
  const palette = usePalette()
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
          <Text style={[styles.caption, { color: palette.muted }]}>
            Signed in as {session?.user.email}
          </Text>
          <Text style={[styles.caption, { color: palette.muted }]}>Net worth</Text>
          <Text style={[styles.netWorth, { color: palette.text }]}>
            {formatCurrency(netWorth)}
          </Text>
          {error && <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>}
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={[styles.signOut, { color: palette.danger }]}>Sign out</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.row, { borderBottomColor: palette.hairline }]}>
          <View style={styles.rowText}>
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.meta, { color: palette.muted }]}>
              {item.type}
              {item.mask ? ` ••${item.mask}` : ''}
            </Text>
          </View>
          <Text style={[styles.balance, { color: palette.text }]}>
            {formatCurrency(LIABILITY_TYPES.has(item.type) ? -item.balance : item.balance)}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: palette.muted }]}>
          No accounts yet — connect one on the web app.
        </Text>
      }
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 16 },
  caption: { fontSize: 13, marginBottom: 2 },
  netWorth: { fontSize: 34, fontWeight: '700' },
  signOut: { fontSize: 14, marginTop: 10 },
  error: { fontSize: 13, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, marginRight: 12 },
  name: { fontSize: 16 },
  meta: { fontSize: 12, marginTop: 2 },
  balance: { fontSize: 16, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40 },
})
