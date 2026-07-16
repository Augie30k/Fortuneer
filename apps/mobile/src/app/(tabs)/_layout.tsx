import { Tabs } from 'expo-router'
import { SymbolView, type SFSymbol } from 'expo-symbols'
import type { ColorValue } from 'react-native'

function tabIcon(name: SFSymbol) {
  return ({ color }: { color: ColorValue }) => (
    <SymbolView name={name} tintColor={color} size={26} />
  )
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#208AEF', headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('chart.pie.fill') }}
      />
      <Tabs.Screen
        name="transactions"
        options={{ title: 'Transactions', tabBarIcon: tabIcon('list.bullet.rectangle.fill') }}
      />
      <Tabs.Screen
        name="vera"
        options={{ title: 'Vera', tabBarIcon: tabIcon('sparkles') }}
      />
    </Tabs>
  )
}
