import { StyleSheet, Text, TextInput, View } from 'react-native'

// Placeholder shell for Vera chat. The real implementation will call the web
// app's /api/vera endpoint with the user's Supabase access token — the Groq
// key stays server-side, never in the app binary. The routing heuristics
// (model pick, history window) are already shared via @fortuneer/shared.
export default function VeraScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>Vera</Text>
        <Text style={styles.subtitle}>
          Your financial assistant is coming to mobile soon. For now, chat with
          Vera on the web app.
        </Text>
      </View>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Message Vera (coming soon)"
          placeholderTextColor="#8a8a8e"
          editable={false}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 28, fontWeight: '700', color: '#e5e5ea' },
  subtitle: {
    fontSize: 15,
    color: '#8a8a8e',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  composer: { padding: 16, paddingBottom: 32 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8a8a8e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#e5e5ea',
    backgroundColor: 'rgba(120,120,128,0.12)',
  },
})
