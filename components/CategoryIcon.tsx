import {
  ArrowDownLeft,
  ArrowUpRight,
  Baby,
  Banknote,
  Beer,
  BookOpen,
  Briefcase,
  Bus,
  CarFront,
  Cat,
  CircleEllipsis,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  Phone,
  PiggyBank,
  Pizza,
  Plane,
  PlugZap,
  Receipt,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trees,
  Tv,
  Utensils,
  Wine,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Keys are stored in categories.icon; seeded values must stay present
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
  // extended set for custom categories
  'coffee': Coffee,
  'pizza': Pizza,
  'beer': Beer,
  'wine': Wine,
  'shopping-cart': ShoppingCart,
  'shirt': Shirt,
  'gift': Gift,
  'gamepad': Gamepad2,
  'tv': Tv,
  'music': Music,
  'book': BookOpen,
  'graduation-cap': GraduationCap,
  'baby': Baby,
  'paw-print': PawPrint,
  'cat': Cat,
  'dumbbell': Dumbbell,
  'scissors': Scissors,
  'phone': Phone,
  'laptop': Laptop,
  'briefcase': Briefcase,
  'bus': Bus,
  'fuel': Fuel,
  'trees': Trees,
  'piggy-bank': PiggyBank,
}

/** Icon keys offered in the custom-category picker */
export const PICKER_ICONS = [
  'circle-ellipsis', 'coffee', 'pizza', 'utensils', 'beer', 'wine',
  'shopping-cart', 'shopping-bag', 'shirt', 'gift', 'gamepad', 'tv',
  'music', 'clapperboard', 'book', 'graduation-cap', 'baby', 'paw-print',
  'cat', 'dumbbell', 'heart-pulse', 'scissors', 'sparkles', 'phone',
  'laptop', 'briefcase', 'car-front', 'bus', 'fuel', 'plane', 'trees',
  'house', 'plug-zap', 'wrench', 'landmark', 'piggy-bank', 'banknote',
  'receipt', 'hand-heart',
]

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
