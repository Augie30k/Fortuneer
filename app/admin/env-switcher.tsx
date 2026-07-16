import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ADMIN_ENV_COOKIE, adminEnabled, getAdminEnv } from '@/lib/admin'
import type { AdminEnv } from '@/lib/supabase-admin'
import { cn } from '@/lib/utils'

async function setAdminEnv(formData: FormData) {
  'use server'
  if (!adminEnabled()) throw new Error('Admin hub is disabled')

  const env: AdminEnv = formData.get('env') === 'production' ? 'production' : 'development'
  const store = await cookies()
  store.set(ADMIN_ENV_COOKIE, env, { httpOnly: true, sameSite: 'lax' })
  revalidatePath('/admin', 'layout')
}

/** Lets the operator flip which Supabase project (dev/prod) the admin hub
 *  reads from, independent of which project the app itself is "live" on. */
export async function EnvSwitcher() {
  const env = await getAdminEnv()
  return (
    <form action={setAdminEnv} className="ml-auto flex items-center gap-1 rounded-lg border p-1">
      <EnvButton env="development" active={env === 'development'} />
      <EnvButton env="production" active={env === 'production'} />
    </form>
  )
}

function EnvButton({ env, active }: { env: AdminEnv; active: boolean }) {
  const isProd = env === 'production'
  return (
    <button
      type="submit"
      name="env"
      value={env}
      disabled={active}
      className={cn(
        'rounded-md px-2.5 py-1 text-xs font-medium uppercase tracking-wide transition-colors disabled:cursor-default',
        active
          ? isProd
            ? 'bg-destructive/15 text-destructive'
            : 'bg-secondary text-secondary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {isProd ? 'Prod' : 'Dev'}
    </button>
  )
}
