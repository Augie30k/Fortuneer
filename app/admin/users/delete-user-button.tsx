'use client'

import { Button } from '@/components/ui/button'

/** Deleting a user is irreversible, so require an explicit confirmation
 *  (spelling out whose data is destroyed) before the action fires. */
export function DeleteUserButton({
  userId,
  email,
  action,
}: {
  userId: string
  email: string
  action: (formData: FormData) => Promise<void>
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const confirmed = window.confirm(
          `Permanently delete ${email} and ALL of their data (accounts, transactions, budgets, goals, Plaid connections)?\n\nThis cannot be undone.`
        )
        if (!confirmed) e.preventDefault()
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="destructive" size="xs">
        Delete
      </Button>
    </form>
  )
}
