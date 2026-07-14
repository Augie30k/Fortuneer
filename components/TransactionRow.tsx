'use client'

/* eslint-disable @next/next/no-img-element */
import type { TransactionWithRefs } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatSignedAmount, relativeDate } from '@/lib/format'
import CategoryIcon from '@/components/CategoryIcon'
import { Badge } from '@/components/ui/badge'

export default function TransactionRow({
  transaction,
  onClick,
}: {
  transaction: TransactionWithRefs
  onClick?: () => void
}) {
  const isInflow = transaction.amount < 0

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex w-full items-center gap-3 px-1 py-2.5 text-left',
        onClick && 'cursor-pointer rounded-lg transition-colors hover:bg-accent'
      )}
    >
      {transaction.logo_url ? (
        <img
          src={transaction.logo_url}
          alt=""
          className="size-8 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <CategoryIcon
          chip
          icon={transaction.categories?.icon}
          color={transaction.categories?.color}
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {transaction.merchant_name ?? transaction.description}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {transaction.categories?.name ?? 'Uncategorized'}
          {transaction.accounts?.name && <> · {transaction.accounts.name}</>}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            'text-sm font-semibold tabular-nums',
            isInflow ? 'text-positive' : 'text-foreground'
          )}
        >
          {formatSignedAmount(Number(transaction.amount))}
        </p>
        <p className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          {transaction.pending && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              Pending
            </Badge>
          )}
          {relativeDate(transaction.date)}
        </p>
      </div>
    </button>
  )
}
