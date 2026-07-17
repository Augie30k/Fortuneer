import fs from 'node:fs'
import path from 'node:path'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

const LINKS = [
  {
    label: 'Vercel — web deployments',
    href: process.env.ADMIN_VERCEL_URL ?? 'https://vercel.com/dashboard',
    note: 'Build status, previews, and production deploys for the Next.js app.',
  },
  {
    label: 'EAS — mobile builds',
    href: process.env.ADMIN_EAS_URL ?? 'https://expo.dev',
    note: 'Expo Application Services build queue for the mobile app.',
  },
]

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

export default function DevOpsDeploymentsPage() {
  const pkg = readJson(path.join(process.cwd(), 'package.json'))
  const mobile = readJson(path.join(process.cwd(), 'apps/mobile/app.json')) as
    | { expo?: { version?: string; sdkVersion?: string } }
    | null
  const deps = (pkg?.dependencies ?? {}) as Record<string, string>

  const versions = [
    { label: 'Web app', value: String(pkg?.version ?? 'unknown') },
    { label: 'Mobile app', value: mobile?.expo?.version ?? 'unknown' },
    { label: 'Next.js', value: deps.next ?? 'unknown' },
    { label: 'React', value: deps.react ?? 'unknown' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Deployments</h1>
        <p className="text-sm text-muted-foreground">
          External dashboards for now. Set ADMIN_VERCEL_URL / ADMIN_EAS_URL in .env.local to
          deep-link straight to the projects.
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {versions.map((v) => (
            <div key={v.label}>
              <p className="text-xs text-muted-foreground">{v.label}</p>
              <p className="text-sm font-medium tabular-nums">{v.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {LINKS.map((l) => (
          <Card key={l.label}>
            <CardContent>
              <a href={l.href} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
                {l.label} ↗
              </a>
              <p className="mt-1 text-sm text-muted-foreground">{l.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
