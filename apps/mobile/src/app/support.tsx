import { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { formatDate } from '@fortuneer/shared'

import {
  Card,
  ErrorBanner,
  Pills,
  PrimaryButton,
  SectionHeader,
  Separator,
} from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { loadSupportRequests, submitSupportRequest, type SupportRequest } from '@/lib/queries'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

const KIND_LABEL = { support: 'Support question', feature: 'Feature request' }

export default function SupportScreen() {
  const palette = usePalette()
  const { session } = useAuth()
  const userId = session!.user.id

  const load = useCallback(() => loadSupportRequests(), [])
  const { data, loading, refreshing, error, refresh } = useLoad(load, [userId])
  const requests: SupportRequest[] = data ?? []

  const [kind, setKind] = useState<'support' | 'feature'>('support')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendState, setSendState] = useState<'idle' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState<string | null>(null)

  const canSend = subject.trim().length > 0 && message.trim().length > 0 && !sending

  const send = async () => {
    setSendError(null)
    setSending(true)
    try {
      await submitSupportRequest(userId, kind, subject.trim(), message.trim())
      setSubject('')
      setMessage('')
      setSendState('sent')
      refresh()
    } catch (e) {
      setSendState('error')
      setSendError(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

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
        <ErrorBanner message={error ?? sendError} />

        <Text style={[styles.intro, { color: palette.muted }]}>
          Ask a question or request a feature — it goes straight to the admin.
        </Text>

        <Card style={{ gap: 12, marginTop: 12 }}>
          <Pills
            options={[
              { value: 'support', label: 'Question' },
              { value: 'feature', label: 'Feature request' },
            ]}
            value={kind}
            onChange={setKind}
          />
          <TextInput
            style={[styles.input, { color: palette.text, backgroundColor: palette.inputBg }]}
            value={subject}
            onChangeText={(v) => {
              setSubject(v)
              setSendState('idle')
            }}
            placeholder="Subject"
            placeholderTextColor={palette.muted}
            maxLength={200}
          />
          <TextInput
            style={[
              styles.input,
              styles.message,
              { color: palette.text, backgroundColor: palette.inputBg },
            ]}
            value={message}
            onChangeText={(v) => {
              setMessage(v)
              setSendState('idle')
            }}
            placeholder="What's going on?"
            placeholderTextColor={palette.muted}
            multiline
            maxLength={5000}
          />
          <PrimaryButton
            title={sendState === 'sent' ? 'Sent ✓' : 'Send'}
            onPress={send}
            disabled={!canSend}
            loading={sending}
          />
        </Card>

        {requests.length > 0 && !loading && (
          <>
            <SectionHeader title="Your requests" />
            <Card>
              {requests.map((r, i) => (
                <View key={r.id}>
                  {i > 0 && <Separator />}
                  <View style={styles.requestRow}>
                    <View style={styles.requestBody}>
                      <Text style={[styles.requestSubject, { color: palette.text }]} numberOfLines={1}>
                        {r.subject}
                      </Text>
                      <Text style={[styles.requestMeta, { color: palette.muted }]}>
                        {KIND_LABEL[r.kind]} · {formatDate(r.created_at.slice(0, 10))}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            r.status === 'open' ? palette.accentSoft : palette.inputBg,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: r.status === 'open' ? palette.accent : palette.muted,
                        }}
                      >
                        {r.status === 'open' ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  intro: { fontSize: 13, lineHeight: 18 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  message: { minHeight: 96, textAlignVertical: 'top' },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  requestBody: { flex: 1, minWidth: 0 },
  requestSubject: { fontSize: 14, fontWeight: '500' },
  requestMeta: { fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
})
