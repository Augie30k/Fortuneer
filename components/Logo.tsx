import { cn } from '@/lib/utils'

export default function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="flex size-7 items-center justify-center rounded-[8px] bg-gradient-to-b from-[#3395FF] to-[#0071E3] text-sm font-bold text-white shadow-sm">
        F
      </span>
      <span className="text-lg font-semibold tracking-tight">Fortuneer</span>
    </span>
  )
}
