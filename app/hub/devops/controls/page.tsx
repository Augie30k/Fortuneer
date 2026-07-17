import { revalidatePath } from 'next/cache'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { adminEnabled, getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type FlagKey = 'app_disabled_web' | 'app_disabled_mobile' | 'vera_disabled_web' | 'vera_disabled_mobile'

const SECTIONS: { title: string; description: string; web: FlagKey; mobile: FlagKey }[] = [
  {
    title: 'Block the app',
    description: 'Signed-out and signed-in users alike see a maintenance screen instead of the app.',
    web: 'app_disabled_web',
    mobile: 'app_disabled_mobile',
  },
  {
    title: 'Block Vera',
    description: 'Vera refuses every request with a 403 instead of calling Groq. Per-user blocks live on the Users page.',
    web: 'vera_disabled_web',
    mobile: 'vera_disabled_mobile',
  },
]

async function setAdminFlag(formData: FormData) {
  'use server'
  if (!adminEnabled()) throw new Error('The Hub is disabled')

  const key = String(formData.get('key') ?? '')
  const enabled = formData.get('enabled') === 'true'
  if (!key) return

  const supabase = createAdminClientFor(await getAdminEnv())
  const { error } = await supabase
    .from('admin_flags')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) throw new Error(`Failed to update ${key}: ${error.message}`)

  await supabase.from('admin_events').insert({
    level: 'warn',
    source: 'hub.controls',
    message: `Kill switch ${key} turned ${enabled ? 'ON' : 'off'}`,
  })

  revalidatePath('/hub/devops/controls')
  revalidatePath('/hub/devops')
}

export default async function DevOpsControlsPage() {
  const supabase = createAdminClientFor(await getAdminEnv())
  const { data: flags, error } = await supabase.from('admin_flags').select('key, enabled, updated_at')

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Failed to load controls: {error.message}
        {error.message.includes('admin_flags') &&
          ' — has migration 021_admin_controls_logging.sql been applied?'}
      </p>
    )
  }

  const flagByKey = new Map((flags ?? []).map((f) => [f.key, f]))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Controls</h1>
        <p className="text-sm text-muted-foreground">
          Kill switches, scoped independently per frontend type. Every flip is logged.
        </p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
              <div className="flex gap-3">
                <FlagToggle
                  flagKey={s.web}
                  label="Web"
                  enabled={flagByKey.get(s.web)?.enabled ?? false}
                  updatedAt={flagByKey.get(s.web)?.updated_at ?? null}
                />
                <FlagToggle
                  flagKey={s.mobile}
                  label="Mobile"
                  enabled={flagByKey.get(s.mobile)?.enabled ?? false}
                  updatedAt={flagByKey.get(s.mobile)?.updated_at ?? null}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function FlagToggle({
  flagKey,
  label,
  enabled,
  updatedAt,
}: {
  flagKey: FlagKey
  label: string
  enabled: boolean
  updatedAt: string | null
}) {
  return (
    <div className="rounded-lg border p-2">
      <form action={setAdminFlag} className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            enabled
              ? 'bg-destructive/15 text-destructive'
              : 'bg-secondary text-secondary-foreground'
          )}
        >
          {enabled ? 'Blocked' : 'Allowed'}
        </span>
        <input type="hidden" name="key" value={flagKey} />
        <input type="hidden" name="enabled" value={String(!enabled)} />
        <Button type="submit" variant="outline" size="xs">
          {enabled ? 'Unblock' : 'Block'}
        </Button>
      </form>
      <p className="mt-1 text-xs text-muted-foreground">
        {updatedAt ? `Changed ${formatDate(updatedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : '—'}
      </p>
    </div>
  )
}
