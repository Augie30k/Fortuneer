import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import {
  LIABILITY_ACCOUNT_TYPES,
  formatCurrency,
  type AccountType,
  type AccountWithItem,
} from '@fortuneer/shared'

import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingView,
  SectionHeader,
  Separator,
  SymbolChip,
} from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { ACCOUNT_TYPE_META, ACCOUNT_TYPE_ORDER } from '@/lib/category-icons'
import { loadAccounts } from '@/lib/queries'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

export default function AccountsScreen() {
  const { session } = useAuth()
  const palette = usePalette()
  const userId = session!.user.id
  const [showHidden, setShowHidden] = useState(false)

  const load = useCallback(() => loadAccounts(userId), [userId])
  const { data, loading, refreshing, error, refresh } = useLoad(load, [userId])

  if (loading || !data) return <LoadingView />

  const visible = data.filter((a) => !a.hidden)
  const hidden = data.filter((a) => a.hidden)

  const byType = new Map<AccountType, AccountWithItem[]>()
  for (const a of visible) {
    const type = (ACCOUNT_TYPE_ORDER.includes(a.type) ? a.type : 'other') as AccountType
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type)!.push(a)
  }

  const netWorth = visible.reduce(
    (sum, a) => sum + (LIABILITY_ACCOUNT_TYPES.has(a.type) ? -a.balance : a.balance),
    0
  )

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <ErrorBanner message={error} />

      {data.length === 0 ? (
        <Card>
          <EmptyState
            symbol="building.columns.fill"
            title="No accounts yet"
            message="Connect a bank or add a manual account on the web app — everything shows up here automatically."
          />
        </Card>
      ) : (
        <>
          <Text style={[styles.caption, { color: palette.muted }]}>TOTAL NET WORTH</Text>
          <Text style={[styles.total, { color: palette.text }]}>{formatCurrency(netWorth)}</Text>

          {ACCOUNT_TYPE_ORDER.map((type) => {
            const accounts = byType.get(type)
            if (!accounts?.length) return null
            const meta = ACCOUNT_TYPE_META[type]
            const subtotal = accounts.reduce((s, a) => s + a.balance, 0)
            const isLiability = LIABILITY_ACCOUNT_TYPES.has(type)
            return (
              <View key={type}>
                <SectionHeader
                  title={meta.label}
                  action={
                    <Text style={[styles.subtotal, { color: palette.muted }]}>
                      {formatCurrency(isLiability ? -subtotal : subtotal)}
                    </Text>
                  }
                />
                <Card>
                  {accounts.map((a, i) => (
                    <View key={a.id}>
                      {i > 0 && <Separator inset={46} />}
                      <AccountRow account={a} typeColor={meta.color} />
                    </View>
                  ))}
                </Card>
              </View>
            )
          })}

          {hidden.length > 0 && (
            <>
              <SectionHeader
                title={`Hidden (${hidden.length})`}
                action={
                  <Pressable onPress={() => setShowHidden((v) => !v)} hitSlop={8}>
                    <Text style={{ color: palette.accent, fontSize: 13, fontWeight: '500' }}>
                      {showHidden ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                }
              />
              {showHidden && (
                <Card>
                  {hidden.map((a, i) => (
                    <View key={a.id}>
                      {i > 0 && <Separator inset={46} />}
                      <AccountRow account={a} typeColor="#8E8E93" dimmed />
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}

          <Text style={[styles.footnote, { color: palette.faint }]}>
            Connect new institutions and manage accounts on the web app.
          </Text>
        </>
      )}
    </ScrollView>
  )
}

function AccountRow({
  account: a,
  typeColor,
  dimmed = false,
}: {
  account: AccountWithItem
  typeColor: string
  dimmed?: boolean
}) {
  const palette = usePalette()
  const router = useRouter()
  const isLiability = LIABILITY_ACCOUNT_TYPES.has(a.type)
  const meta = ACCOUNT_TYPE_META[(a.type in ACCOUNT_TYPE_META ? a.type : 'other') as AccountType]

  const subtitle = [
    a.plaid_items?.institution_name ?? (a.is_manual ? 'Manual' : null),
    a.mask ? `••${a.mask}` : null,
    a.is_manual && a.apy > 0 ? `${a.apy}% APY` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Pressable
      style={({ pressed }) => [styles.row, (pressed || dimmed) && { opacity: 0.55 }]}
      onPress={() => router.push(`/account/${a.id}`)}
    >
      {a.plaid_items?.logo_url ? (
        <Image source={{ uri: a.plaid_items.logo_url }} style={styles.logo} contentFit="cover" />
      ) : (
        <SymbolChip symbol={meta.symbol} color={typeColor} />
      )}
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: palette.text }]} numberOfLines={1}>
          {a.name}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowMeta, { color: palette.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowBalance, { color: palette.text }]}>
        {formatCurrency(isLiability ? -a.balance : a.balance)}
      </Text>
      <SymbolView name="chevron.right" size={13} tintColor={palette.faint} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  total: { fontSize: 34, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  subtotal: { fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  logo: { width: 34, height: 34, borderRadius: 10 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '500' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowBalance: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  footnote: { fontSize: 12, textAlign: 'center', marginTop: 24 },
})
