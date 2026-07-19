import type { SFSymbol } from 'expo-symbols'
import type { AccountType } from '@fortuneer/shared'

// categories.icon stores lucide-react keys (web renders them directly).
// Mobile maps each key to the closest SF Symbol so both platforms read the
// same data. Keys must cover components/CategoryIcon.tsx's ICONS table.
const CATEGORY_SYMBOLS: Record<string, SFSymbol> = {
  'banknote': 'banknote.fill',
  'arrow-down-left': 'arrow.down.left',
  'arrow-up-right': 'arrow.up.right',
  'landmark': 'building.columns.fill',
  'receipt': 'doc.plaintext.fill',
  'clapperboard': 'film.fill',
  'utensils': 'fork.knife',
  'shopping-bag': 'bag.fill',
  'house': 'house.fill',
  'heart-pulse': 'cross.case.fill',
  'sparkles': 'sparkles',
  'wrench': 'wrench.and.screwdriver.fill',
  'hand-heart': 'heart.circle.fill',
  'car-front': 'car.fill',
  'plane': 'airplane',
  'plug-zap': 'bolt.fill',
  'circle-ellipsis': 'ellipsis.circle.fill',
  'coffee': 'cup.and.saucer.fill',
  'pizza': 'takeoutbag.and.cup.and.straw.fill',
  'beer': 'mug.fill',
  'wine': 'wineglass',
  'shopping-cart': 'cart.fill',
  'shirt': 'tshirt.fill',
  'gift': 'gift.fill',
  'gamepad': 'gamecontroller.fill',
  'tv': 'tv',
  'music': 'music.note',
  'book': 'book.fill',
  'graduation-cap': 'graduationcap.fill',
  'baby': 'teddybear.fill',
  'paw-print': 'pawprint.fill',
  'cat': 'cat.fill',
  'dumbbell': 'dumbbell.fill',
  'scissors': 'scissors',
  'phone': 'phone.fill',
  'laptop': 'laptopcomputer',
  'briefcase': 'briefcase.fill',
  'bus': 'bus',
  'fuel': 'fuelpump.fill',
  'trees': 'tree.fill',
  'piggy-bank': 'dollarsign.circle.fill',
}

export function categorySymbol(icon: string | null | undefined): SFSymbol {
  return (icon && CATEGORY_SYMBOLS[icon]) || 'ellipsis.circle.fill'
}

// Mirrors web lib/account-types.ts TYPE_META (which is lucide-bound and so
// can't be shared directly).
export const ACCOUNT_TYPE_META: Record<
  AccountType,
  { label: string; symbol: SFSymbol; color: string }
> = {
  depository: { label: 'Cash', symbol: 'banknote.fill', color: '#248A3D' },
  credit: { label: 'Credit cards', symbol: 'creditcard.fill', color: '#FF9500' },
  investment: { label: 'Investments', symbol: 'chart.line.uptrend.xyaxis', color: '#0071E3' },
  loan: { label: 'Loans', symbol: 'building.columns.fill', color: '#AF52DE' },
  other: { label: 'Other', symbol: 'wallet.pass.fill', color: '#8E8E93' },
}

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'depository',
  'credit',
  'investment',
  'loan',
  'other',
]
