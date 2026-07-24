import { Pressable, StyleSheet, Text, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { usePalette } from '@/lib/theme'
import { useAuth } from '@/lib/auth-context'

// Shown instead of the tab navigator when the account is pending approval,
// blocked, or an admin has flipped the 'app_disabled_mobile' kill switch
// (Admin Hub → Controls). Mirrors the web app's /account-status page.
export default function BlockedScreen() {
  const palette = usePalette()
  const { pending } = useAuth()

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <Text style={[styles.title, { color: palette.text }]}>
        {pending ? 'Awaiting approval' : 'Access unavailable'}
      </Text>
      <Text style={[styles.subtitle, { color: palette.muted }]}>
        {pending
          ? 'Your access request is in — an admin needs to approve your account before you can use Fortuneer. Check back soon.'
          : 'Your account has been blocked, or the app is temporarily unavailable on mobile. If you think this is a mistake, reach out on the web app.'}
      </Text>
      <Pressable onPress={() => supabase.auth.signOut()}>
        <Text style={[styles.signOut, { color: palette.danger }]}>Sign out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  signOut: { fontSize: 14, marginTop: 24 },
})
