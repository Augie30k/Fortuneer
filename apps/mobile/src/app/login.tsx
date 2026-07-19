import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Logo from '@/components/Logo'
import { supabase } from '@/lib/supabase'
import { usePalette } from '@/lib/theme'

export default function LoginScreen() {
  const insets = useSafeAreaInsets()
  const palette = usePalette()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading

  const handleLogin = async () => {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    // On success the root layout's session guard swaps to the tabs group.
    if (error) setError(error.message)
    setLoading(false)
  }

  const inputStyle = [
    styles.input,
    { color: palette.text, backgroundColor: palette.inputBg, borderColor: palette.border },
  ]

  return (
    <KeyboardAvoidingView
      style={[
        styles.screen,
        { backgroundColor: palette.bg, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.body}>
        <Logo size={40} style={styles.brand} />
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Sign in to your account
        </Text>

        <View style={styles.form}>
          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={palette.muted}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => canSubmit && handleLogin()}
          />

          {error && <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>}

          <Pressable
            style={[
              styles.button,
              { backgroundColor: palette.accent },
              !canSubmit && styles.buttonDisabled,
            ]}
            disabled={!canSubmit}
            onPress={handleLogin}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </View>

        <Text style={[styles.footnote, { color: palette.muted }]}>
          New to Fortuneer? Create your account on the web app — signups need
          email confirmation and admin approval first.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  brand: { alignSelf: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 6, marginBottom: 32 },
  form: { gap: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { fontSize: 14 },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footnote: { fontSize: 13, textAlign: 'center', marginTop: 28, lineHeight: 18 },
})
