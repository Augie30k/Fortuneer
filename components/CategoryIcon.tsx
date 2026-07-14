import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CarFront,
  CircleEllipsis,
  Clapperboard,
  HandHeart,
  HeartPulse,
  House,
  Landmark,
  Plane,
  PlugZap,
  Receipt,
  ShoppingBag,
  Sparkles,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Keys match categories.icon values seeded in 001_core_schema.sql
const ICONS: Record<string, LucideIcon> = {
  'banknote': Banknote,
  'arrow-down-left': ArrowDownLeft,
  'arrow-up-right': ArrowUpRight,
  'landmark': Landmark,
  'receipt': Receipt,
  'clapperboard': Clapperboard,
  'utensils': Utensils,
  'shopping-bag': ShoppingBag,
  'house': House,
  'heart-pulse': HeartPulse,
  'sparkles': Sparkles,
  'wrench': Wrench,
  'hand-heart': HandHeart,
  'car-front': CarFront,
  'plane': Plane,
  'plug-zap': PlugZap,
  'circle-ellipsis': CircleEllipsis,
}

interface CategoryIconProps {
  icon: string | null | undefined
  color?: string | null
  className?: string
  /** Renders inside a tinted rounded square, iOS-style */
  chip?: boolean
}

export default function CategoryIcon({ icon, color, className, chip = false }: CategoryIconProps) {
  const Icon = (icon && ICONS[icon]) || CircleEllipsis
  const tint = color ?? '#8E8E93'

  if (!chip) {
    return <Icon className={cn('size-4', className)} style={{ color: tint }} />
  }

  return (
    <span
      className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', className)}
      style={{ backgroundColor: `color-mix(in srgb, ${tint} 15%, transparent)` }}
    >
      <Icon className="size-4" style={{ color: tint }} />
    </span>
  )
}
