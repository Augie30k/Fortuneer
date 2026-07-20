import type { LucideIcon } from 'lucide-react-native'
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
  CreditCard,
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
  TrendingUp,
  Tv,
  Utensils,
  Wallet,
  Wine,
  Wrench,
} from 'lucide-react-native'
import type { AccountType } from '@fortuneer/shared'

// categories.icon stores lucide-react keys. Mobile renders the exact same
// lucide icon set natively via lucide-react-native, so category/account
// iconography matches the web app pixel-for-pixel instead of approximating
// with SF Symbols. Keys must cover components/CategoryIcon.tsx's ICONS table.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
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

export function categorySymbol(icon: string | null | undefined): LucideIcon {
  return (icon && CATEGORY_ICONS[icon]) || CircleEllipsis
}

// Mirrors web lib/account-types.ts TYPE_META — same lucide icons and colors,
// so account-type iconography matches the web app exactly.
export const ACCOUNT_TYPE_META: Record<
  AccountType,
  { label: string; symbol: LucideIcon; color: string }
> = {
  depository: { label: 'Cash', symbol: Banknote, color: '#248A3D' },
  credit: { label: 'Credit cards', symbol: CreditCard, color: '#FF9500' },
  investment: { label: 'Investments', symbol: TrendingUp, color: '#0071E3' },
  loan: { label: 'Loans', symbol: Landmark, color: '#AF52DE' },
  other: { label: 'Other', symbol: Wallet, color: '#8E8E93' },
}

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'depository',
  'credit',
  'investment',
  'loan',
  'other',
]
