import { Tabs, useRouter } from 'expo-router'
import { Pressable } from 'react-native'
import { SymbolView, type SFSymbol } from 'expo-symbols'
import type { ColorValue } from 'react-native'

import { useSidebar } from '@/components/Sidebar'
import { usePalette } from '@/lib/theme'

function tabIcon(name: SFSymbol) {
  return ({ color }: { color: ColorValue }) => (
    <SymbolView name={name} tintColor={color} size={26} />
  )
}

function HeaderButton({ symbol, onPress }: { symbol: SFSymbol; onPress: () => void }) {
  const palette = usePalette()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [{ paddingHorizontal: 16 }, pressed && { opacity: 0.5 }]}
    >
      <SymbolView name={symbol} tintColor={palette.text} size={22} />
    </Pressable>
  )
}

export default function TabsLayout() {
  const palette = usePalette()
  const sidebar = useSidebar()
  const router = useRouter()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.accent,
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.bg },
        headerTitleStyle: { color: palette.text, fontSize: 17, fontWeight: '600' },
        headerLeft: () => (
          <HeaderButton symbol="line.3.horizontal" onPress={sidebar.open} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('house.fill') }}
      />
      <Tabs.Screen
        name="accounts"
        options={{ title: 'Accounts', tabBarIcon: tabIcon('building.columns.fill') }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: tabIcon('list.bullet.rectangle.fill'),
          headerRight: () => (
            <HeaderButton symbol="plus" onPress={() => router.push('/transaction/new')} />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{ title: 'Budgets', tabBarIcon: tabIcon('chart.pie.fill') }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', tabBarIcon: tabIcon('chart.bar.xaxis') }}
      />
    </Tabs>
  )
}
