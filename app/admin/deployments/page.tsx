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

export default function AdminDeploymentsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Deployments</h1>
        <p className="text-sm text-muted-foreground">
          External dashboards for now. Set ADMIN_VERCEL_URL / ADMIN_EAS_URL in .env.local to
          deep-link straight to the projects.
        </p>
      </div>

      <ul className="space-y-3">
        {LINKS.map((l) => (
          <li key={l.label} className="rounded border p-4">
            <a href={l.href} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
              {l.label} ↗
            </a>
            <p className="mt-1 text-sm text-muted-foreground">{l.note}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
