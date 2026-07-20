import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePathname, useRouter, type Href } from 'expo-router'
import { LifeBuoy, LogOut, Repeat, Settings, Sparkles, Target, TrendingUp, type LucideIcon } from 'lucide-react-native'

import Logo from '@/components/Logo'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { usePalette } from '@/lib/theme'

const SidebarContext = createContext<{ open: () => void }>({ open: () => {} })

export function useSidebar() {
  return useContext(SidebarContext)
}

// Drawer items use lucide-react-native so they match the web sidebar's nav
// icons exactly (same set as components/Sidebar.tsx on web).
const ITEMS: { href: Href & string; label: string; icon: LucideIcon }[] = [
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/investments', label: 'Investments', icon: TrendingUp },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/vera', label: 'Vera', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/support', label: 'Support', icon: LifeBuoy },
]

/** Slide-in navigation drawer for everything that isn't a bottom tab.
 *  Closed by default; opened from the hamburger in each tab's header. */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const progress = useRef(new Animated.Value(0)).current
  const { width: screenWidth } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const palette = usePalette()
  const router = useRouter()
  const pathname = usePathname()
  const { session } = useAuth()

  const width = Math.min(320, screenWidth * 0.8)

  const animate = useCallback(
    (to: number, done?: () => void) => {
      Animated.timing(progress, {
        toValue: to,
        duration: 240,
        easing: to === 1 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(done)
    },
    [progress]
  )

  const open = useCallback(() => {
    setVisible(true)
    animate(1)
  }, [animate])

  const close = useCallback(
    (after?: () => void) => {
      animate(0, () => {
        setVisible(false)
        after?.()
      })
    },
    [animate]
  )

  // Close when the route changes underneath (e.g. android back button)
  useEffect(() => {
    if (visible) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const go = (href: Href & string) => {
    if (pathname === href) {
      close()
      return
    }
    close(() => router.push(href))
  }

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  return (
    <SidebarContext.Provider value={{ open }}>
      <View style={styles.fill}>
        {children}
        {visible && (
          <View style={StyleSheet.absoluteFill}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
              <Pressable
                style={[styles.fill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
                onPress={() => close()}
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.panel,
                {
                  width,
                  backgroundColor: palette.dark ? '#161618' : '#FFFFFF',
                  paddingTop: insets.top + 18,
                  paddingBottom: insets.bottom + 12,
                  transform: [
                    {
                      translateX: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-width, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Logo size={26} style={styles.brand} />
              {session?.user.email ? (
                <Text style={[styles.email, { color: palette.muted }]} numberOfLines={1}>
                  {session.user.email}
                </Text>
              ) : null}

              <View style={styles.items}>
                {ITEMS.map((item) => {
                  const active = pathname === item.href
                  return (
                    <Pressable
                      key={item.href}
                      onPress={() => go(item.href)}
                      style={[styles.item, active && { backgroundColor: palette.accentSoft }]}
                    >
                      <item.icon
                        size={20}
                        color={active ? palette.accent : palette.muted}
                      />
                      <Text
                        style={[
                          styles.itemLabel,
                          { color: active ? palette.accent : palette.text },
                          active && { fontWeight: '600' },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <Pressable onPress={confirmSignOut} style={styles.item}>
                <LogOut size={20} color={palette.danger} />
                <Text style={[styles.itemLabel, { color: palette.danger }]}>Sign out</Text>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>
    </SidebarContext.Provider>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 14,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  brand: { paddingHorizontal: 12 },
  email: { fontSize: 13, marginTop: 2, paddingHorizontal: 12 },
  items: { flex: 1, marginTop: 22, gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  itemLabel: { fontSize: 16 },
})
