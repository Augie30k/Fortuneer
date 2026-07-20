import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useState } from 'react'

import AnimatedSplash from '@/components/AnimatedSplash'
import { SidebarProvider } from '@/components/Sidebar'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { ThemeModeProvider, usePalette } from '@/lib/theme'

SplashScreen.preventAutoHideAsync()

// Match react-navigation's chrome (headers, backgrounds) to the app palette
const LightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#208AEF',
    background: '#F2F2F7',
    card: '#F2F2F7',
  },
}
const DarkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#208AEF',
    background: '#000000',
    card: '#000000',
  },
}

function RootNavigator() {
  const { session, loading, blocked } = useAuth()
  const [showSplash, setShowSplash] = useState(true)

  return (
    <SidebarProvider>
      <Stack
        screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal' }}
      >
        <Stack.Protected guard={!!session && !blocked}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="goals" options={{ headerShown: true, title: 'Goals' }} />
          <Stack.Screen name="investments" options={{ headerShown: true, title: 'Investments' }} />
          <Stack.Screen name="recurring" options={{ headerShown: true, title: 'Recurring' }} />
          <Stack.Screen name="vera" options={{ headerShown: true, title: 'Vera' }} />
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
          <Stack.Screen name="support" options={{ headerShown: true, title: 'Support' }} />
          <Stack.Screen name="account/[id]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen
            name="transaction/[id]"
            options={{ headerShown: true, title: 'Transaction', presentation: 'modal' }}
          />
          <Stack.Screen
            name="transaction/new"
            options={{ headerShown: true, title: 'Add transaction', presentation: 'modal' }}
          />
          <Stack.Screen
            name="budget-edit"
            options={{ headerShown: true, title: 'Edit budget', presentation: 'modal' }}
          />
          <Stack.Screen
            name="goal-contribute"
            options={{ headerShown: true, title: 'Contribute', presentation: 'modal' }}
          />
          <Stack.Screen
            name="goal-allocate"
            options={{ headerShown: true, title: 'Monthly plan', presentation: 'modal' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!!session && blocked}>
          <Stack.Screen name="blocked" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
      {showSplash && (
        <AnimatedSplash ready={!loading} onFinish={() => setShowSplash(false)} />
      )}
    </SidebarProvider>
  )
}

function ThemedApp() {
  const palette = usePalette()

  // Keep the native root view + status bar in sync with the resolved theme
  // (system or manual override) — without this, a manual override away from
  // the system setting leaves the status bar/root background mismatched.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.bg)
  }, [palette.bg])

  return (
    <ThemeProvider value={palette.dark ? DarkNavTheme : LightNavTheme}>
      <StatusBar style={palette.dark ? 'light' : 'dark'} />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <ThemedApp />
    </ThemeModeProvider>
  )
}
