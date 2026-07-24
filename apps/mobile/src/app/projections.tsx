import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Armchair,
  Baby,
  Banknote,
  Briefcase,
  CarFront,
  Coins,
  Gem,
  House,
  Info,
  MapPin,
  Minus,
  Pause,
  Plane,
  Plus,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native'
import {
  DEFAULT_ASSUMPTIONS,
  LIFE_EVENT_TEMPLATES,
  computeEventImpacts,
  currentMonth,
  deriveBaselineAssumptions,
  formatCurrency,
  formatCurrencyCompact,
  monthAdd,
  simulateProjection,
  type LifeEvent,
  type LifeEventKind,
  type ProjectionAssumptions,
} from '@fortuneer/shared'

import { FanChart } from '@/components/charts'
import PickerSheet from '@/components/PickerSheet'
import {
  Card,
  ErrorBanner,
  LoadingView,
  Pills,
  PrimaryButton,
  SectionHeader,
  Separator,
  SymbolChip,
} from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { loadProjections, saveProjectionScenario } from '@/lib/queries'
import { usePalette } from '@/lib/theme'
import { useLoad } from '@/lib/use-load'

const EVENT_ICONS: Record<LifeEventKind, LucideIcon> = {
  home: House,
  car: CarFront,
  child: Baby,
  raise: TrendingUp,
  'career-break': Pause,
  wedding: Gem,
  trip: Plane,
  windfall: Coins,
  business: Briefcase,
  move: MapPin,
  retire: Armchair,
  'debt-free': Banknote,
  custom: Sparkles,
}

const templateFor = (kind: LifeEventKind) =>
  LIFE_EVENT_TEMPLATES.find((t) => t.kind === kind) ?? LIFE_EVENT_TEMPLATES[LIFE_EVENT_TEMPLATES.length - 1]

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function eventMonthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS_SHORT[m - 1]} ${y}`
}

function signedMoney(v: number) {
  const abs = formatCurrency(Math.abs(v), 'USD', { maximumFractionDigits: 0 })
  return v < 0 ? `−${abs}` : `+${abs}`
}

const parseNum = (text: string) => {
  const n = parseFloat(text.replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

interface WorkingScenario {
  id: string | null
  name: string
  assumptions: ProjectionAssumptions
  events: LifeEvent[]
}

const HORIZON_OPTIONS = [
  { value: '10', label: '10y' },
  { value: '20', label: '20y' },
  { value: '25', label: '25y' },
  { value: '30', label: '30y' },
  { value: '40', label: '40y' },
]

export default function ProjectionsScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { session } = useAuth()

  const load = useCallback(() => loadProjections(), [])
  // No focus refetch: this screen holds unsaved edits in local state
  const { data, loading, refreshing, error, refresh } = useLoad(load, [], { refetchOnFocus: false })

  const [scenario, setScenario] = useState<WorkingScenario | null>(null)
  const [editing, setEditing] = useState<LifeEvent | null>(null)
  const [templatePicker, setTemplatePicker] = useState(false)
  const [autoState, setAutoState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const hydratedRef = useRef(false)
  const savingRef = useRef(false)

  useEffect(() => {
    if (!data || scenario) return
    if (data.scenario) {
      setScenario({
        id: data.scenario.id,
        name: data.scenario.name,
        assumptions: data.scenario.assumptions,
        events: data.scenario.events ?? [],
      })
    } else {
      setScenario({
        id: null,
        name: 'My trajectory',
        assumptions: deriveBaselineAssumptions({ netWorth: data.netWorth, cashFlow: data.cashFlow }),
        events: [],
      })
    }
  }, [data, scenario])

  const result = useMemo(
    () => (scenario ? simulateProjection(scenario.assumptions, scenario.events) : null),
    [scenario]
  )
  const impacts = useMemo(
    () => (scenario ? computeEventImpacts(scenario.assumptions, scenario.events) : []),
    [scenario]
  )
  const impactById = useMemo(() => new Map(impacts.map((i) => [i.eventId, i.horizonDelta])), [impacts])

  // Autosave: edits persist after a short pause, so people can leave and
  // come back without losing their trajectory. Mirrors the web page.
  useEffect(() => {
    if (!scenario || !session?.user.id) return
    if (!hydratedRef.current) {
      hydratedRef.current = true
      return
    }
    setAutoState('saving')
    const t = setTimeout(async () => {
      if (savingRef.current) return
      savingRef.current = true
      try {
        const saved = await saveProjectionScenario(session.user.id, scenario)
        if (!scenario.id) {
          hydratedRef.current = false // adopting the new id isn't an edit
          setScenario((s) => (s ? { ...s, id: saved.id } : s))
        }
        setAutoState('saved')
      } catch {
        setAutoState('idle')
      } finally {
        savingRef.current = false
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [scenario, session?.user.id])

  if (loading || !scenario || !result) return <LoadingView />

  const { assumptions, events } = scenario
  const setAssumption = (patch: Partial<ProjectionAssumptions>) => {
    setScenario((s) => (s ? { ...s, assumptions: { ...s.assumptions, ...patch } } : s))
  }

  const horizonYear = Number(currentMonth().slice(0, 4)) + assumptions.years
  const fi = result.milestones.find((m) => m.kind === 'fi')
  const sortedEvents = [...events].sort((a, b) => a.start.localeCompare(b.start))

  const addEvent = (kind: LifeEventKind) => {
    const t = templateFor(kind)
    const event: LifeEvent = {
      id: uid(),
      kind,
      name: t.kind === 'custom' ? 'Custom event' : t.label,
      start: monthAdd(currentMonth(), t.yearsOut * 12),
      ...t.defaults,
    }
    setScenario((s) => (s ? { ...s, events: [...s.events, event] } : s))
    setEditing(event)
  }

  const saveEditing = () => {
    if (!editing) return
    setScenario((s) =>
      s ? { ...s, events: s.events.map((e) => (e.id === editing.id ? editing : e)) } : s
    )
    setEditing(null)
  }

  const removeEvent = (id: string) => {
    setScenario((s) => (s ? { ...s, events: s.events.filter((e) => e.id !== id) } : s))
    setEditing(null)
  }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: palette.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <ErrorBanner message={error} />

        <Text style={[styles.caption, { color: palette.muted }]}>
          EXPECTED IN {horizonYear}
          {assumptions.currentAge !== null ? ` · AGE ${assumptions.currentAge + assumptions.years}` : ''}
        </Text>
        <Text style={[styles.total, { color: palette.text }]}>
          {formatCurrency(result.horizon, 'USD', { maximumFractionDigits: 0 })}
        </Text>
        <View style={styles.rangeRow}>
          <Text style={[styles.range, { color: palette.muted }]}>
            {formatCurrencyCompact(result.horizonLow)} – {formatCurrencyCompact(result.horizonHigh)}
          </Text>
          <InfoDot
            title="Range"
            text="The low end if markets struggle, the high end if they do well — the shaded band on the chart."
          />
        </View>

        <Card style={{ marginTop: 16 }}>
          <FanChart
            points={result.points}
            events={sortedEvents.map((e) => ({ month: e.start, color: templateFor(e.kind).color }))}
            ageBase={assumptions.currentAge}
          />
        </Card>

        <View style={{ marginTop: 12 }}>
          <Pills
            options={HORIZON_OPTIONS}
            value={String(assumptions.years)}
            onChange={(v) => setAssumption({ years: Number(v) })}
          />
        </View>

        <SectionHeader
          title="Life events"
          action={
            <Pressable onPress={() => setTemplatePicker(true)} hitSlop={8}>
              <Text style={{ color: palette.accent, fontSize: 13, fontWeight: '600' }}>Add</Text>
            </Pressable>
          }
        />
        <Card>
          {sortedEvents.length === 0 ? (
            <Text style={[styles.emptyEvents, { color: palette.muted }]}>
              Add a home, a child, a career change — watch the path bend.
            </Text>
          ) : (
            sortedEvents.map((e, i) => {
              const impact = impactById.get(e.id) ?? 0
              return (
                <View key={e.id}>
                  {i > 0 && <Separator inset={46} />}
                  <Pressable onPress={() => setEditing({ ...e })} style={styles.eventRow}>
                    <SymbolChip symbol={EVENT_ICONS[e.kind]} color={templateFor(e.kind).color} />
                    <View style={styles.eventBody}>
                      <Text style={[styles.eventName, { color: palette.text }]} numberOfLines={1}>
                        {e.name}
                      </Text>
                      <Text style={[styles.eventMeta, { color: palette.muted }]} numberOfLines={1}>
                        {eventMonthLabel(e.start)}
                        {e.oneTime !== 0 ? ` · ${signedMoney(e.oneTime)} once` : ''}
                        {e.monthly !== 0 ? ` · ${signedMoney(e.monthly)}/mo` : ''}
                      </Text>
                    </View>
                    <View style={styles.eventRight}>
                      <Text
                        style={[
                          styles.eventImpact,
                          { color: impact >= 0 ? palette.positive : palette.danger },
                        ]}
                      >
                        {signedMoney(Math.round(impact))}
                      </Text>
                      <Text style={[styles.eventImpactSub, { color: palette.faint }]}>
                        by {horizonYear}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              )
            })
          )}
        </Card>

        <SectionHeader title="Baseline" />
        {/* Keyed so freshly loaded values repopulate the inputs' defaultValue */}
        <Card key={scenario.id ?? 'new'}>
          <AssumptionRow
            label="Net worth"
            value={assumptions.netWorth}
            prefix="$"
            info="Everything you own minus everything you owe — seeded from your accounts."
            onCommit={(v) => setAssumption({ netWorth: v })}
          />
          <Separator />
          <AssumptionRow
            label="Money in"
            value={assumptions.monthlyIncome}
            prefix="$"
            info="Average monthly take-home income, from your history."
            onCommit={(v) => setAssumption({ monthlyIncome: v })}
          />
          <Separator />
          <AssumptionRow
            label="Money out"
            value={assumptions.monthlySpending}
            prefix="$"
            info="Typical monthly spending, from your history."
            onCommit={(v) => setAssumption({ monthlySpending: v })}
          />
          <Separator />
          <AssumptionRow
            label="Growth"
            value={assumptions.annualReturn}
            suffix="%/yr"
            info="What your savings and investments earn on average each year. 6% ≈ a balanced portfolio."
            onCommit={(v) => setAssumption({ annualReturn: v })}
          />
          <Separator />
          <AssumptionRow
            label="Market swing"
            value={assumptions.returnSpread}
            suffix="±%"
            info="How far good or bad markets could land from your growth guess — sets the width of the shaded band."
            onCommit={(v) => setAssumption({ returnSpread: Math.max(0, v) })}
          />
          <Separator />
          <AssumptionRow
            label="Raises"
            value={assumptions.incomeGrowth}
            suffix="%/yr"
            info="How much your income grows each year."
            onCommit={(v) => setAssumption({ incomeGrowth: v })}
          />
          <Separator />
          <AssumptionRow
            label="Inflation"
            value={assumptions.inflation}
            suffix="%/yr"
            info="Your spending creeps up this much each year."
            onCommit={(v) => setAssumption({ inflation: v })}
          />
          <Separator />
          <AssumptionRow
            label="Age"
            value={assumptions.currentAge ?? 0}
            info="Optional — the timeline can read “Age 40” instead of “2036”."
            onCommit={(v) => setAssumption({ currentAge: v > 0 ? Math.round(v) : null })}
          />
        </Card>

        {result.milestones.length > 0 && (
          <>
            <SectionHeader title="Milestones ahead" />
            <Card>
              {result.milestones.map((m, i) => (
                <View key={`${m.kind}-${m.label}-${m.month}`}>
                  {i > 0 && <Separator />}
                  <View style={styles.milestoneRow}>
                    <Text
                      style={[
                        styles.milestoneLabel,
                        {
                          color:
                            m.kind === 'fi'
                              ? palette.positive
                              : m.kind === 'dip'
                                ? palette.danger
                                : palette.text,
                        },
                      ]}
                    >
                      {m.label}
                    </Text>
                    <Text style={[styles.milestoneWhen, { color: palette.muted }]}>
                      {eventMonthLabel(m.month)}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
        {fi === undefined && result.milestones.length === 0 && (
          <Text style={[styles.footnote, { color: palette.faint }]}>
            No milestones within {assumptions.years} years yet — try a longer horizon or higher savings.
          </Text>
        )}

        <View style={styles.footnoteRow}>
          <Text style={[styles.footnote, { color: palette.faint, marginTop: 0 }]}>
            {autoState === 'saving' ? 'Saving…' : 'Saved automatically · A what-if, not advice'}
          </Text>
          <InfoDot
            title="About this projection"
            text={`Your edits save on their own — come back anytime.\n\nThis is a deterministic what-if, not financial advice: the shaded band shows markets landing ±${assumptions.returnSpread}% around your ${assumptions.annualReturn}% growth guess.`}
          />
        </View>
      </ScrollView>

      <PickerSheet
        title="Add a life event"
        visible={templatePicker}
        options={LIFE_EVENT_TEMPLATES.map((t) => ({
          key: t.kind,
          label: t.label,
          sublabel: t.description,
          symbol: EVENT_ICONS[t.kind],
          color: t.color,
        }))}
        selectedKey={null}
        onSelect={(key) => key && addEvent(key as LifeEventKind)}
        onClose={() => setTemplatePicker(false)}
      />

      <EventEditor
        event={editing}
        onChange={setEditing}
        onDone={saveEditing}
        onDelete={removeEvent}
        onClose={() => setEditing(null)}
      />
    </>
  )
}

/** Info icon that explains a short label via a native alert. */
function InfoDot({ title, text }: { title: string; text: string }) {
  const palette = usePalette()
  return (
    <Pressable hitSlop={10} onPress={() => Alert.alert(title, text)}>
      <Info size={14} color={palette.faint} />
    </Pressable>
  )
}

function AssumptionRow({
  label,
  value,
  prefix,
  suffix,
  info,
  onCommit,
}: {
  label: string
  value: number
  prefix?: string
  suffix?: string
  info?: string
  onCommit: (v: number) => void
}) {
  const palette = usePalette()
  return (
    <View style={styles.assumptionRow}>
      <View style={styles.labelRow}>
        <Text style={[styles.assumptionLabel, { color: palette.text }]}>{label}</Text>
        {info ? <InfoDot title={label} text={info} /> : null}
      </View>
      <View style={[styles.assumptionInputWrap, { backgroundColor: palette.inputBg }]}>
        {prefix ? <Text style={{ color: palette.muted, fontSize: 15 }}>{prefix}</Text> : null}
        <TextInput
          defaultValue={String(value)}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
          onChangeText={(text) => onCommit(parseNum(text))}
          style={[styles.assumptionInput, { color: palette.text }]}
        />
        {suffix ? <Text style={{ color: palette.muted, fontSize: 15 }}>{suffix}</Text> : null}
      </View>
    </View>
  )
}

function Stepper({
  label,
  onMinus,
  onPlus,
}: {
  label: string
  onMinus: () => void
  onPlus: () => void
}) {
  const palette = usePalette()
  return (
    <View style={[styles.stepper, { backgroundColor: palette.inputBg }]}>
      <Pressable onPress={onMinus} hitSlop={8} style={styles.stepperButton}>
        <Minus size={16} color={palette.accent} />
      </Pressable>
      <Text style={[styles.stepperLabel, { color: palette.text }]}>{label}</Text>
      <Pressable onPress={onPlus} hitSlop={8} style={styles.stepperButton}>
        <Plus size={16} color={palette.accent} />
      </Pressable>
    </View>
  )
}

function EditorField({
  label,
  value,
  prefix,
  suffix,
  info,
  onCommit,
}: {
  label: string
  value: number
  prefix?: string
  suffix?: string
  info?: string
  onCommit: (v: number) => void
}) {
  const palette = usePalette()
  return (
    <View style={styles.editorField}>
      <View style={styles.editorLabelRow}>
        <Text style={[styles.editorLabel, { color: palette.muted }]}>{label}</Text>
        {info ? <InfoDot title={label} text={info} /> : null}
      </View>
      <View style={[styles.assumptionInputWrap, { backgroundColor: palette.inputBg, alignSelf: 'stretch' }]}>
        {prefix ? <Text style={{ color: palette.muted, fontSize: 15 }}>{prefix}</Text> : null}
        <TextInput
          defaultValue={String(value)}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
          onChangeText={(text) => onCommit(parseNum(text))}
          style={[styles.assumptionInput, { color: palette.text, flex: 1, textAlign: 'left' }]}
        />
        {suffix ? <Text style={{ color: palette.muted, fontSize: 15 }}>{suffix}</Text> : null}
      </View>
    </View>
  )
}

/** Amount field with an explicit "money out / money in" toggle so users
 *  never think about negative numbers — mirrors the web dialog. */
function SignedEditorField({
  label,
  value,
  outLabel,
  inLabel,
  info,
  onCommit,
}: {
  label: string
  value: number
  outLabel: string
  inLabel: string
  info?: string
  onCommit: (v: number) => void
}) {
  const palette = usePalette()
  const [dir, setDir] = useState<'out' | 'in'>(value > 0 ? 'in' : 'out')
  const [abs, setAbs] = useState(Math.abs(value))
  const commit = (amount: number, direction: 'out' | 'in') =>
    onCommit(direction === 'out' ? -Math.abs(amount) : Math.abs(amount))
  return (
    <View style={styles.editorField}>
      <View style={styles.editorLabelRow}>
        <Text style={[styles.editorLabel, { color: palette.muted }]}>{label}</Text>
        {info ? <InfoDot title={label} text={info} /> : null}
      </View>
      <View style={[styles.pills, { backgroundColor: palette.inputBg, marginBottom: 8 }]}>
        {(
          [
            ['out', outLabel],
            ['in', inLabel],
          ] as const
        ).map(([d, text]) => {
          const active = dir === d
          return (
            <Pressable
              key={d}
              onPress={() => {
                setDir(d)
                commit(abs, d)
              }}
              style={[styles.pill, active && { backgroundColor: palette.card }]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? '600' : '400',
                  color: active ? (d === 'out' ? palette.danger : palette.positive) : palette.muted,
                }}
              >
                {text}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <View style={[styles.assumptionInputWrap, { backgroundColor: palette.inputBg, alignSelf: 'stretch' }]}>
        <Text style={{ color: palette.muted, fontSize: 15 }}>$</Text>
        <TextInput
          defaultValue={String(Math.abs(value))}
          keyboardType="numeric"
          returnKeyType="done"
          onChangeText={(text) => {
            const amount = Math.abs(parseNum(text))
            setAbs(amount)
            commit(amount, dir)
          }}
          style={[styles.assumptionInput, { color: palette.text, flex: 1, textAlign: 'left' }]}
        />
      </View>
    </View>
  )
}

function EventEditor({
  event,
  onChange,
  onDone,
  onDelete,
  onClose,
}: {
  event: LifeEvent | null
  onChange: (e: LifeEvent) => void
  onDone: () => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  if (!event) return null

  const template = templateFor(event.kind)
  const [year, month] = event.start.split('-').map(Number)
  const hasAsset = event.kind === 'home' || event.kind === 'business' || event.kind === 'custom'

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView
        style={{ backgroundColor: palette.bg }}
        contentContainerStyle={[styles.editorContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.editorHeader}>
          <SymbolChip symbol={EVENT_ICONS[event.kind]} color={template.color} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.editorTitle, { color: palette.text }]}>{template.label}</Text>
            <Text style={[styles.editorSub, { color: palette.muted }]} numberOfLines={2}>
              {template.description}
            </Text>
          </View>
        </View>

        <View style={styles.editorField}>
          <Text style={[styles.editorLabel, { color: palette.muted }]}>Name</Text>
          <TextInput
            defaultValue={event.name}
            onChangeText={(text) => onChange({ ...event, name: text || template.label })}
            style={[
              styles.editorNameInput,
              { backgroundColor: palette.inputBg, color: palette.text },
            ]}
          />
        </View>

        <View style={styles.editorField}>
          <Text style={[styles.editorLabel, { color: palette.muted }]}>When</Text>
          <View style={styles.stepperRow}>
            <Stepper
              label={MONTHS_SHORT[month - 1]}
              onMinus={() => onChange({ ...event, start: monthAdd(event.start, -1) })}
              onPlus={() => onChange({ ...event, start: monthAdd(event.start, 1) })}
            />
            <Stepper
              label={String(year)}
              onMinus={() => onChange({ ...event, start: monthAdd(event.start, -12) })}
              onPlus={() => onChange({ ...event, start: monthAdd(event.start, 12) })}
            />
          </View>
        </View>

        {/* Keyed so switching events repopulates the numeric defaults */}
        <View key={event.id}>
          <SignedEditorField
            label="Up-front"
            outLabel="Money out"
            inLabel="Money in"
            value={event.oneTime}
            info="Paid or received once, when this happens."
            onCommit={(v) => onChange({ ...event, oneTime: v })}
          />
          <SignedEditorField
            label="Monthly"
            outLabel="Costs me"
            inLabel="Saves me"
            value={event.monthly}
            info="Ongoing change to your monthly budget afterwards."
            onCommit={(v) => onChange({ ...event, monthly: v })}
          />
          <EditorField
            label="Duration (months)"
            value={event.months ?? 0}
            info="How long the monthly amount lasts — 0 means ongoing."
            onCommit={(v) => onChange({ ...event, months: v > 0 ? Math.round(v) : null })}
          />
          {hasAsset && (
            <>
              <EditorField
                label="Asset value"
                prefix="$"
                value={event.assetValue}
                info="The home or stake you'd own — its growth adds to your net worth."
                onCommit={(v) => onChange({ ...event, assetValue: Math.max(0, v) })}
              />
              <EditorField
                label="Growth (%/yr)"
                value={event.assetGrowth}
                info="Typical home appreciation is 3–4% a year."
                onCommit={(v) => onChange({ ...event, assetGrowth: v })}
              />
            </>
          )}
        </View>

        <View style={{ marginTop: 20, gap: 10 }}>
          <PrimaryButton title="Done" onPress={onDone} />
          <PrimaryButton title="Remove event" destructive onPress={() => onDelete(event.id)} />
        </View>
      </ScrollView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  total: { fontSize: 34, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  range: { fontSize: 13 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  emptyEvents: { fontSize: 13, lineHeight: 18, paddingVertical: 8 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  eventBody: { flex: 1, minWidth: 0 },
  eventName: { fontSize: 15, fontWeight: '500' },
  eventMeta: { fontSize: 12, marginTop: 2 },
  eventRight: { alignItems: 'flex-end' },
  eventImpact: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  eventImpactSub: { fontSize: 11, marginTop: 1 },
  assumptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
  },
  labelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  assumptionLabel: { fontSize: 15 },
  assumptionInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 110,
  },
  assumptionInput: {
    fontSize: 15,
    flex: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  milestoneLabel: { fontSize: 15, fontWeight: '500' },
  milestoneWhen: { fontSize: 13 },
  footnote: { fontSize: 12, lineHeight: 17, marginTop: 12, textAlign: 'center' },
  editorContent: { padding: 20 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  editorTitle: { fontSize: 20, fontWeight: '700' },
  editorSub: { fontSize: 13, marginTop: 2 },
  editorField: { marginBottom: 14 },
  editorLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  editorLabel: { fontSize: 13, fontWeight: '600' },
  editorNameInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  stepperRow: { flexDirection: 'row', gap: 10 },
  pills: { flexDirection: 'row', borderRadius: 9, padding: 2 },
  pill: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 7 },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  stepperButton: { padding: 2 },
  stepperLabel: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
})
