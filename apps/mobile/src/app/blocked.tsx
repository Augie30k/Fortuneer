import { Pressable, StyleSheet, Text, View } from 'react-native'
import { supabase } from '@/lib/supabase'

// Shown instead of the tab navigator when the account is blocked or an
// admin has flipped the 'app_disabled_mobile' kill switch (Admin Hub →
// Controls). Mirrors the web app's /account-status page.
export default function BlockedScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Access unavailable</Text>
      <Text style={styles.subtitle}>
        Your account has been blocked, or the app is temporarily unavailable on mobile.
        If you think this is a mistake, reach out on the web app.
      </Text>
      <Pressable onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOut}>Sign out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#e5e5ea', textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    color: '#8a8a8e',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  signOut: { color: '#ff453a', fontSize: 14, marginTop: 24 },
})
