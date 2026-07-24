import { useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  TERMS_SECTIONS,
  type TermsBlock,
  type TermsSegment,
} from '@fortuneer/shared'
import { PrimaryButton } from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { usePalette, type Palette } from '@/lib/theme'

/** Terms & Conditions. Doubles as the acceptance gate: while auth-context
 *  reports termsPending (user hasn't accepted the current TERMS_VERSION) the
 *  navigator can only show this screen and the agree/decline footer appears;
 *  afterwards it's reachable read-only from Settings. Renders the same
 *  shared terms data as the web app's /terms pages. */
export default function TermsScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { session, termsPending, refreshAccess } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async () => {
    if (!session?.user.id) return
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      })
      .eq('id', session.user.id)
    if (error) {
      setError('Could not save your acceptance — please try again.')
      setSaving(false)
      return
    }
    await refreshAccess()
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        style={[styles.scroll, { borderColor: palette.border, backgroundColor: palette.card }]}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.title, { color: palette.text }]}>Terms & Conditions</Text>
        <Text style={[styles.version, { color: palette.muted }]}>
          Version {TERMS_VERSION} · Effective {TERMS_EFFECTIVE_DATE}
        </Text>
        {TERMS_SECTIONS.map((section) => (
          <View key={section.n} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              {section.n}. {section.title}
            </Text>
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} palette={palette} />
            ))}
          </View>
        ))}
      </ScrollView>

      {termsPending ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {error && <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>}
          <PrimaryButton
            title="I agree to the Terms & Conditions"
            onPress={accept}
            loading={saving}
          />
          <Pressable onPress={() => supabase.auth.signOut()} disabled={saving}>
            <Text style={[styles.decline, { color: palette.muted }]}>Decline and sign out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingBottom: insets.bottom + 12 }} />
      )}
    </View>
  )
}

function Block({ block, palette }: { block: TermsBlock; palette: Palette }) {
  if (block.type === 'list') {
    return (
      <View style={styles.list}>
        {block.items.map((item, i) => (
          <View key={i} style={styles.listItem}>
            <Text style={[styles.bullet, { color: palette.muted }]}>•</Text>
            <Text style={[styles.body, styles.listText, { color: palette.text }]}>
              <Segments segments={item} palette={palette} />
            </Text>
          </View>
        ))}
      </View>
    )
  }
  return (
    <Text
      style={[
        styles.body,
        { color: palette.text },
        block.caps && { textTransform: 'uppercase' },
      ]}
    >
      <Segments segments={block.segments} palette={palette} />
    </Text>
  )
}

function Segments({ segments, palette }: { segments: TermsSegment[]; palette: Palette }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (typeof seg === 'string') return <Text key={i}>{seg}</Text>
        if ('bold' in seg) {
          return (
            <Text key={i} style={styles.bold}>
              {seg.bold}
            </Text>
          )
        }
        return (
          <Text
            key={i}
            style={[styles.link, { color: palette.accent }]}
            onPress={() => Linking.openURL(seg.link.href)}
          >
            {seg.link.text}
          </Text>
        )
      })}
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  scroll: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: '700' },
  version: { fontSize: 12, marginTop: 4 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  body: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  bold: { fontWeight: '600' },
  link: { textDecorationLine: 'underline' },
  list: { marginTop: 4 },
  listItem: { flexDirection: 'row', paddingLeft: 4 },
  bullet: { fontSize: 13, lineHeight: 19, marginTop: 6, marginRight: 6 },
  listText: { flex: 1 },
  footer: { paddingTop: 12, gap: 12, alignItems: 'stretch' },
  decline: { fontSize: 14, textAlign: 'center' },
  error: { fontSize: 13, textAlign: 'center' },
})
