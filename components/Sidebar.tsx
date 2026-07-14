'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathname = usePathname()

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/accounts', label: 'Accounts', icon: '💼' },
    { href: '/transactions', label: 'Transactions', icon: '📝' },
    { href: '/budgets', label: 'Budgets', icon: '💰' },
  ]

  return (
    <aside className="w-64 min-h-screen bg-[#0D0B28] border-r border-white/10 p-6 flex flex-col">
      <nav className="space-y-2 flex-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
              pathname === link.href
                ? 'bg-[#6D28D9] text-[#EEE8F5]'
                : 'text-[#8B8BA8] hover:bg-[#12103A] hover:text-[#EEE8F5]'
            }`}
          >
            <span className="mr-2">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 pt-4 mt-4">
        <p className="text-xs text-[#8B8BA8] uppercase tracking-wider mb-3">Settings</p>
        <Link
          href="/settings"
          className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
            pathname === '/settings'
              ? 'bg-[#6D28D9] text-[#EEE8F5]'
              : 'text-[#8B8BA8] hover:bg-[#12103A] hover:text-[#EEE8F5]'
          }`}
        >
          ⚙️ Settings
        </Link>
      </div>
    </aside>
  )
}
