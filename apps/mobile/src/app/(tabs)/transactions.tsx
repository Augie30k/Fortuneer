import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import type { AccountWithItem, Category, TransactionWithRefs } from '@fortuneer/shared'

import PickerSheet from '@/components/PickerSheet'
import TransactionRow from '@/components/TransactionRow'
import { Card, EmptyState, ErrorBanner, Separator } from '@/components/ui'
import { categorySymbol } from '@/lib/category-icons'
import {
  TXN_PAGE_SIZE,
  loadAccounts,
  loadCategories,
  loadTransactions,
} from '@/lib/queries'
import { useAuth } from '@/lib/auth-context'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

export default function TransactionsScreen() {
  const palette = usePalette()
  const { session } = useAuth()
  const userId = session!.user.id

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [picker, setPicker] = useState<'category' | 'account' | null>(null)

  const [transactions, setTransactions] = useState<TransactionWithRefs[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasLoaded = useRef(false)

  // Debounce typed search into the applied query
  useEffect(() => {
    const handle = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(handle)
  }, [search])

  const filters = useRef({ q: query, categoryId, accountId })
  filters.current = { q: query, categoryId, accountId }

  const fetchPage = useCallback(
    async (offset: number, mode: 'initial' | 'refresh' | 'more' | 'silent') => {
      if (mode === 'initial') setLoading(true)
      if (mode === 'refresh') setRefreshing(true)
      if (mode === 'more') setLoadingMore(true)
      try {
        const { transactions: page, total: count } = await loadTransactions(
          filters.current,
          offset
        )
        hasLoaded.current = true
        setTotal(count)
        setTransactions((prev) => (offset === 0 ? page : [...prev, ...page]))
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load transactions')
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchPage(0, hasLoaded.current ? 'silent' : 'initial')
  }, [query, categoryId, accountId, fetchPage])

  // Silently refresh the visible page when returning from an edit/add modal
  useFocusEffect(
    useCallback(() => {
      if (hasLoaded.current) fetchPage(0, 'silent')
    }, [fetchPage])
  )

  const { data: pickerData } = useLoad(
    async () => {
      const [categories, accounts] = await Promise.all([loadCategories(), loadAccounts(userId)])
      return { categories, accounts }
    },
    [userId],
    { refetchOnFocus: false }
  )
  const categories: Category[] = pickerData?.categories ?? []
  const accounts: AccountWithItem[] = pickerData?.accounts ?? []

  const activeCategory = categories.find((c) => c.id === categoryId)
  const activeAccount = accounts.find((a) => a.id === accountId)

  const loadMore = () => {
    if (loading || loadingMore || transactions.length >= total) return
    if (transactions.length < TXN_PAGE_SIZE) return
    fetchPage(transactions.length, 'more')
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      {/* Search + filters */}
      <View style={styles.controls}>
        <View style={[styles.searchBox, { backgroundColor: palette.inputBg }]}>
          <SymbolView name="magnifyingglass" size={15} tintColor={palette.muted} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder="Search vendors and descriptions"
            placeholderTextColor={palette.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <View style={styles.chipRow}>
          <FilterChip
            label={activeCategory?.name ?? 'Category'}
            active={!!categoryId}
            onPress={() => setPicker('category')}
            onClear={() => setCategoryId(null)}
          />
          <FilterChip
            label={activeAccount?.name ?? 'Account'}
            active={!!accountId}
            onPress={() => setPicker('account')}
            onClear={() => setAccountId(null)}
          />
          <Text style={[styles.count, { color: palette.faint }]}>
            {loading ? '' : `${total} total`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchPage(0, 'refresh')} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListHeaderComponent={<ErrorBanner message={error} />}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.rowCard,
                { backgroundColor: palette.card },
                index === 0 && styles.rowCardFirst,
                index === transactions.length - 1 && styles.rowCardLast,
              ]}
            >
              {index > 0 && <Separator inset={46} />}
              <TransactionRow transaction={item} />
            </View>
          )}
          ListEmptyComponent={
            <Card>
              <EmptyState
                symbol="list.bullet.rectangle"
                title="No transactions found"
                message={
                  query || categoryId || accountId
                    ? 'Try changing the search or filters.'
                    : 'Transactions appear here once your accounts sync.'
                }
              />
            </Card>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator />
              </View>
            ) : null
          }
        />
      )}

      <PickerSheet
        title="Filter by category"
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
        title="Filter by account"
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
    </View>
  )
}

function FilterChip({
  label,
  active,
  onPress,
  onClear,
}: {
  label: string
  active: boolean
  onPress: () => void
  onClear: () => void
}) {
  const palette = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? palette.accentSoft : palette.inputBg },
      ]}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: active ? '600' : '400',
          color: active ? palette.accent : palette.muted,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {active ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <SymbolView name="xmark.circle.fill" size={15} tintColor={palette.accent} />
        </Pressable>
      ) : (
        <SymbolView name="chevron.down" size={11} tintColor={palette.muted} />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 150,
  },
  count: { fontSize: 12, marginLeft: 'auto' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  rowCard: { paddingHorizontal: 16 },
  rowCardFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  rowCardLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
})
