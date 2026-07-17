import { redirect } from 'next/navigation'

/** The admin hub became The Hub at /hub — forward old bookmarks to wherever
 *  each page landed in the three-mode split (proxy.ts still 404s /admin
 *  entirely when the hub is disabled). */
const MOVED: Record<string, string> = {
  overview: '/hub/admin',
  users: '/hub/admin/users',
  support: '/hub/admin/support',
  usage: '/hub/analyst/costs',
  mobile: '/hub/analyst/engagement',
  controls: '/hub/devops/controls',
  logs: '/hub/devops/logs',
  deployments: '/hub/devops/deployments',
}

export default async function AdminMovedPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params
  redirect(MOVED[path?.[0] ?? ''] ?? '/hub')
}
