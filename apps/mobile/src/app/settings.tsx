import { useCallback, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { Profile } from '@fortuneer/shared'

import {
  Card,
  ErrorBanner,
  LoadingView,
  Pills,
  PrimaryButton,
  SectionHeader,
  Separator,
} from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { type ThemeMode, usePalette, useThemeMode } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

const APPEARANCE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export default function SettingsScreen() {
  const palette = usePalette()
  const { mode, setMode } = useThemeMode()
  const { session } = useAuth()
  const userId = session!.user.id

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) throw error
    return data as Profile
  }, [userId])

  const { data: profile, loading, refreshing, error, refresh } = useLoad(load, [userId])

  const [name, setName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (loading || !profile) return <LoadingView />

  const nameValue = name ?? (profile.full_name ?? '')
  const dirty = nameValue.trim() !== (profile.full_name ?? '')

  const saveProfile = async () => {
    setSaveError(null)
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: nameValue.trim() || null })
        .eq('id', userId)
      if (updateError) throw updateError
      await refresh()
      setName(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  const version = process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0'

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <ErrorBanner message={error ?? saveError} />

        <SectionHeader title="Profile" />
        <Card style={{ gap: 10 }}>
          <View>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Name</Text>
            <TextInput
              style={[styles.input, { color: palette.text, backgroundColor: palette.inputBg }]}
              value={nameValue}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={palette.muted}
            />
          </View>
          <FactRow label="Email" value={profile.email ?? session!.user.email ?? '—'} />
          <FactRow label="Currency" value={profile.currency} />
          {dirty && (
            <PrimaryButton title="Save profile" onPress={saveProfile} loading={saving} />
          )}
        </Card>

        <SectionHeader title="App" />
        <Card style={{ gap: 10 }}>
          <View>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Appearance</Text>
            <Pills options={APPEARANCE_OPTIONS} value={mode} onChange={setMode} />
          </View>
          <Separator />
          <FactRow label="Version" value={version} />
        </Card>

        <Text style={[styles.footnote, { color: palette.faint }]}>
          Categories, rules, bank connections, and account deletion are managed on the web app.
        </Text>

        <View style={{ marginTop: 12 }}>
          <PrimaryButton title="Sign out" onPress={confirmSignOut} destructive />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function FactRow({ label, value }: { label: string; value: string }) {
  const palette = usePalette()
  return (
    <View style={styles.factRow}>
      <Text style={[styles.factLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: palette.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 5 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  factLabel: { fontSize: 14 },
  factValue: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  footnote: { fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 17 },
})
