import { cn } from '@/lib/utils'

export default function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="relative flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#3395FF] to-[#0071E3] shadow-sm">
        <svg viewBox="0 0 512 512" className="absolute inset-0 size-full" aria-hidden="true">
          <rect x="154" y="123" width="56" height="266" rx="28" fill="#FFFFFF" />
          <rect x="154" y="123" width="195" height="56" rx="28" fill="#FFFFFF" />
          <rect x="154" y="230" width="148" height="56" rx="28" fill="#FFFFFF" opacity="0.6" />
          <circle cx="343" cy="353" r="36" fill="#FF9500" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight">Fortuneer</span>
    </span>
  )
}
