import { StyleSheet, Text, TextInput, View } from 'react-native'

import { usePalette } from '@/lib/theme'

// Placeholder shell for Vera chat. The real implementation will call the web
// app's /api/vera endpoint with the user's Supabase access token — the Groq
// key stays server-side, never in the app binary. The routing heuristics
// (model pick, history window) are already shared via @fortuneer/shared.
export default function VeraScreen() {
  const palette = usePalette()
  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: palette.text }]}>Vera</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Your financial assistant is coming to mobile soon. For now, chat with
          Vera on the web app.
        </Text>
      </View>
      <View style={styles.composer}>
        <TextInput
          style={[
            styles.input,
            {
              color: palette.text,
              backgroundColor: palette.inputBg,
              borderColor: palette.border,
            },
          ]}
          placeholder="Message Vera (coming soon)"
          placeholderTextColor={palette.muted}
          editable={false}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  composer: { padding: 16, paddingBottom: 32 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
})
