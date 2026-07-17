'use client'

import { Button } from '@/components/ui/button'

/** Deleting log history is irreversible, so require an explicit confirmation
 *  spelling out the retention window before the action fires. */
export function ClearLogsButton({
  action,
  days,
  label,
}: {
  action: (formData: FormData) => Promise<void>
  days: number
  label: string
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const confirmed = window.confirm(
          days > 0
            ? `Delete all logged events older than ${days} days?\n\nThis cannot be undone.`
            : 'Delete ALL logged events?\n\nThis cannot be undone.'
        )
        if (!confirmed) e.preventDefault()
      }}
    >
      <input type="hidden" name="days" value={days} />
      <Button type="submit" variant={days > 0 ? 'outline' : 'destructive'} size="xs">
        {label}
      </Button>
    </form>
  )
}
