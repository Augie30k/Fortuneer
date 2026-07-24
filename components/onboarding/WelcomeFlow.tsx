'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  Landmark,
  Loader2,
  Monitor,
  Moon,
  PiggyBank,
  Sparkles,
  Sun,
  Telescope,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Persona } from '@/lib/types'
import { FOCUS_AREAS, MAX_FOCUS } from '@/lib/focus-areas'
import Logo from '@/components/Logo'
import CategoryIcon from '@/components/CategoryIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']

type Step = 'welcome' | 'you' | 'reason' | 'focus' | 'goal' | 'look' | 'done'
const QUESTION_STEPS: Step[] = ['you', 'reason', 'focus', 'goal', 'look']

type ThemeChoice = 'light' | 'dark' | 'system'

const PERSONAS: {
  key: Persona
  title: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
  focus: string[]
  goalTemplate: string | null
}[] = [
  {
    key: 'debt',
    title: 'Get out of debt',
    desc: 'Payoff plans and progress you can actually see',
    icon: Banknote,
    focus: ['budgets', 'projections'],
    goalTemplate: 'debt',
  },
  {
    key: 'saving',
    title: 'Save for something big',
    desc: 'Goals with real timelines and monthly pace',
    icon: PiggyBank,
    focus: ['goals', 'budgets'],
    goalTemplate: 'emergency',
  },
  {
    key: 'budgeting',
    title: 'Take control of spending',
    desc: 'Budgets that match how you actually live',
    icon: Wallet,
    focus: ['budgets', 'recurring'],
    goalTemplate: null,
  },
  {
    key: 'overview',
    title: 'See my whole picture',
    desc: 'Net worth, cash flow, and accounts in one place',
    icon: Telescope,
    focus: ['reports', 'recurring'],
    goalTemplate: null,
  },
  {
    key: 'investing',
    title: 'Grow my money',
    desc: 'Investments and long-term projections',
    icon: TrendingUp,
    focus: ['investments', 'projections'],
    goalTemplate: null,
  },
]


const GOAL_TEMPLATES = [
  { key: 'emergency', label: 'Emergency fund', icon: 'piggy-bank', color: '#248A3D', amount: 5000 },
  { key: 'trip', label: 'Trip', icon: 'plane', color: '#0071E3', amount: 2500 },
  { key: 'home', label: 'Down payment', icon: 'house', color: '#AF52DE', amount: 40000 },
  { key: 'car', label: 'New car', icon: 'car-front', color: '#30B0C7', amount: 15000 },
  { key: 'debt', label: 'Pay off debt', icon: 'banknote', color: '#FF375F', amount: 3000 },
]

/** "augie30k" → "Augie" — a friendly prefill, never sent unless kept */
function nameFromEmail(email: string): string {
  const base = email.split('@')[0].split(/[._+\-]/)[0].replace(/\d+$/, '')
  return base ? base[0].toUpperCase() + base.slice(1) : ''
}

export default function WelcomeFlow({
  email,
  initialName,
  initialCurrency,
}: {
  email: string
  initialName: string
  initialCurrency: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const [name, setName] = useState(initialName || nameFromEmail(email))
  const [currency, setCurrency] = useState(initialCurrency)
  const [persona, setPersona] = useState<Persona | null>(null)
  const [focus, setFocus] = useState<string[]>([])
  const [focusTouched, setFocusTouched] = useState(false)
  const [goalTemplate, setGoalTemplate] = useState<string | null>(null)
  const [goalName, setGoalName] = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const [theme, setTheme] = useState<ThemeChoice>('system')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme') as ThemeChoice | null
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {}
  }, [])

  const pickPersona = (p: (typeof PERSONAS)[number]) => {
    setPersona(p.key)
    // Seed later steps from the choice — the visible payoff Reddit users ask
    // for ("why did you ask me that?") — but never clobber edits.
    if (!focusTouched) setFocus(p.focus)
    if (!goalTemplate && !goalName && p.goalTemplate) {
      const t = GOAL_TEMPLATES.find((g) => g.key === p.goalTemplate)
      if (t) {
        setGoalTemplate(t.key)
        setGoalName(t.label)
        setGoalAmount(String(t.amount))
      }
    }
  }

  const toggleFocus = (key: string) => {
    setFocusTouched(true)
    setFocus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : prev.length >= MAX_FOCUS ? prev : [...prev, key]
    )
  }

  const pickTemplate = (t: (typeof GOAL_TEMPLATES)[number]) => {
    if (goalTemplate === t.key) {
      setGoalTemplate(null)
      setGoalName('')
      setGoalAmount('')
      return
    }
    setGoalTemplate(t.key)
    setGoalName(t.label)
    setGoalAmount(String(t.amount))
  }

  const applyTheme = (choice: ThemeChoice) => {
    setTheme(choice)
    try {
      if (choice === 'system') {
        localStorage.removeItem('theme')
        document.documentElement.classList.toggle(
          'dark',
          matchMedia('(prefers-color-scheme: dark)').matches
        )
      } else {
        localStorage.setItem('theme', choice)
        document.documentElement.classList.toggle('dark', choice === 'dark')
      }
    } catch {}
  }

  const template = GOAL_TEMPLATES.find((t) => t.key === goalTemplate)
  const goalReady = goalName.trim().length > 0 && Number(goalAmount) > 0

  const buildPayload = () => ({
    preferred_name: name,
    currency,
    persona,
    focus_areas: focus,
    goal: goalReady
      ? {
          name: goalName.trim(),
          target_amount: Number(goalAmount),
          icon: template?.icon ?? 'piggy-bank',
          color: template?.color ?? '#248A3D',
        }
      : null,
  })

  /** Persist whatever has been gathered and mark the profile onboarded.
   *  `destination` set → navigate straight there (the skip path); otherwise
   *  advance to the celebratory summary. */
  const finish = async (destination?: string) => {
    if (saving || leaving) return
    setSaving(true)
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
    } catch {
      // Never strand the user on a failed save — the gate re-shows the flow
      // next visit if onboarded_at didn't stick.
    }
    if (destination) {
      setLeaving(true)
      router.replace(destination)
      return
    }
    setSaving(false)
    setStep('done')
  }

  const goTo = (destination: string) => {
    setLeaving(true)
    router.replace(destination)
  }

  const stepIndex = QUESTION_STEPS.indexOf(step)
  const back = () => {
    if (step === 'you') setStep('welcome')
    else if (stepIndex > 0) setStep(QUESTION_STEPS[stepIndex - 1])
  }

  const personaMeta = PERSONAS.find((p) => p.key === persona)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-5 pt-5 md:px-8">
        <Logo />
        {step !== 'done' && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={saving || leaving}
            onClick={() => finish('/dashboard')}
          >
            {leaving ? <Loader2 className="size-4 animate-spin" /> : 'Skip for now'}
          </Button>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {stepIndex >= 0 && (
            <div className="mb-8 flex items-center justify-center gap-1.5">
              {QUESTION_STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === stepIndex ? 'w-6 bg-primary' : 'w-1.5',
                    i < stepIndex ? 'bg-primary/50' : i > stepIndex ? 'bg-border' : ''
                  )}
                />
              ))}
            </div>
          )}

          <div key={step} className="animate-[ft-fade-up_0.4s_ease-out_both]">
            {step === 'welcome' && (
              <div className="text-center">
                <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="size-7 text-primary" />
                </span>
                <h1 className="text-3xl font-semibold tracking-tight">Welcome to Fortuneer</h1>
                <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
                  Before you dive in, let&apos;s shape the app around you — what you&apos;re
                  working toward and what you want front and center.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Under a minute. Every step is skippable, and nothing here asks for a bank login.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Button className="h-11 w-full max-w-xs" onClick={() => setStep('you')}>
                    Make it mine
                    <ArrowRight />
                  </Button>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    disabled={saving || leaving}
                    onClick={() => finish('/dashboard')}
                  >
                    I&apos;ll explore on my own
                  </button>
                </div>
              </div>
            )}

            {step === 'you' && (
              <StepFrame
                title="First things first"
                subtitle="What should we call you? This is just for greetings — no forms, no verification."
                onBack={back}
                onNext={() => setStep('reason')}
              >
                <div className="space-y-2">
                  <Label htmlFor="preferred-name">Name</Label>
                  <Input
                    id="preferred-name"
                    placeholder="Your name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </StepFrame>
            )}

            {step === 'reason' && (
              <StepFrame
                title={name ? `What brings you here, ${name.split(' ')[0]}?` : 'What brings you here?'}
                subtitle="One answer is plenty — it decides what we suggest first."
                onBack={back}
                onNext={() => setStep('focus')}
              >
                <div className="space-y-2">
                  {PERSONAS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => pickPersona(p)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                        persona === p.key
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                          : 'border-border hover:bg-accent'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          persona === p.key ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                        )}
                      >
                        <p.icon className="size-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{p.title}</span>
                        <span className="block text-xs text-muted-foreground">{p.desc}</span>
                      </span>
                      {persona === p.key && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  ))}
                </div>
              </StepFrame>
            )}

            {step === 'focus' && (
              <StepFrame
                title="Put your priorities up front"
                subtitle={`Pick up to ${MAX_FOCUS} — they move to the top of your sidebar, right under the Dashboard.`}
                onBack={back}
                onNext={() => setStep('goal')}
              >
                <div className="grid grid-cols-2 gap-2">
                  {FOCUS_AREAS.map((f) => {
                    const selected = focus.includes(f.key)
                    const order = focus.indexOf(f.key)
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => toggleFocus(f.key)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-medium transition-colors',
                          selected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                            : 'border-border hover:bg-accent',
                          !selected && focus.length >= MAX_FOCUS && 'opacity-50'
                        )}
                      >
                        <f.icon
                          className={cn('size-4.5 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')}
                        />
                        <span className="flex-1">{f.label}</span>
                        {selected && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                            {order + 1}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </StepFrame>
            )}

            {step === 'goal' && (
              <StepFrame
                title="Give yourself a target"
                subtitle="Totally optional — but a goal on day one makes the Goals page yours already."
                onBack={back}
                nextLabel={goalReady ? 'Continue' : 'Maybe later'}
                onNext={() => setStep('look')}
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {GOAL_TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => pickTemplate(t)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors',
                        goalTemplate === t.key
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                          : 'border-border hover:bg-accent'
                      )}
                    >
                      <CategoryIcon chip icon={t.icon} color={t.color} />
                      {t.label}
                    </button>
                  ))}
                </div>
                {goalTemplate && (
                  <div className="grid grid-cols-2 gap-3 animate-[ft-fade-up_0.3s_ease-out_both]">
                    <div className="space-y-2">
                      <Label htmlFor="goal-name">Goal name</Label>
                      <Input
                        id="goal-name"
                        value={goalName}
                        onChange={(e) => setGoalName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal-amount">Target amount</Label>
                      <Input
                        id="goal-amount"
                        type="number"
                        min="1"
                        inputMode="decimal"
                        value={goalAmount}
                        onChange={(e) => setGoalAmount(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </StepFrame>
            )}

            {step === 'look' && (
              <StepFrame
                title="Make it easy on the eyes"
                subtitle="Applies instantly — change it anytime in Settings."
                onBack={back}
                nextLabel="Finish"
                nextLoading={saving}
                onNext={() => finish()}
              >
                <div className="flex gap-2">
                  {(
                    [
                      { value: 'light', label: 'Light', icon: Sun },
                      { value: 'dark', label: 'Dark', icon: Moon },
                      { value: 'system', label: 'System', icon: Monitor },
                    ] as const
                  ).map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={theme === value ? 'default' : 'outline'}
                      onClick={() => applyTheme(value)}
                      className="h-16 flex-1 flex-col gap-1.5"
                    >
                      <Icon />
                      {label}
                    </Button>
                  ))}
                </div>
              </StepFrame>
            )}

            {step === 'done' && (
              <div className="text-center">
                <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-positive/10">
                  <Check className="size-7 text-positive" />
                </span>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {name ? `You're all set, ${name.split(' ')[0]}` : "You're all set"}
                </h1>
                <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                  Here&apos;s what Fortuneer tailored for you:
                </p>
                <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm">
                  {name && <DoneItem>We&apos;ll greet you as {name.split(' ')[0]}</DoneItem>}
                  {personaMeta && <DoneItem>Tuned for “{personaMeta.title.toLowerCase()}”</DoneItem>}
                  {focus.length > 0 && (
                    <DoneItem>
                      {focus
                        .map((k) => FOCUS_AREAS.find((f) => f.key === k)?.label)
                        .filter(Boolean)
                        .join(', ')}{' '}
                      moved to the top of your sidebar
                    </DoneItem>
                  )}
                  {goalReady && (
                    <DoneItem>
                      “{goalName.trim()}” is live on your Goals page
                    </DoneItem>
                  )}
                  <DoneItem>
                    {theme === 'system' ? 'Theme follows your device' : `${theme === 'dark' ? 'Dark' : 'Light'} theme on`}
                  </DoneItem>
                </ul>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Button className="h-11 w-full max-w-xs" disabled={leaving} onClick={() => goTo('/dashboard')}>
                    {leaving ? <Loader2 className="size-4 animate-spin" /> : 'Open my dashboard'}
                    {!leaving && <ArrowRight />}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full max-w-xs"
                    disabled={leaving}
                    onClick={() => goTo('/accounts')}
                  >
                    <Landmark />
                    Add my accounts first
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Banks connect securely via Plaid — or add accounts manually, your call.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function StepFrame({
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextLoading = false,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  nextLoading?: boolean
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-6 space-y-4">{children}</div>
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft />
          Back
        </Button>
        <Button onClick={onNext} disabled={nextLoading} className="min-w-28">
          {nextLoading ? <Loader2 className="size-4 animate-spin" /> : nextLabel}
        </Button>
      </div>
    </div>
  )
}

function DoneItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
      <Check className="mt-0.5 size-3.5 shrink-0 text-positive" />
      <span>{children}</span>
    </li>
  )
}
