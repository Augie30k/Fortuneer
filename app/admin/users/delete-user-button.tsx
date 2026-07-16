'use client'

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
      <button
        type="submit"
        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        Delete
      </button>
    </form>
  )
}
