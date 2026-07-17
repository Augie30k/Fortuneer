'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/** Denying is a real decision — it emails the applicant and blocks the
 *  account — so it always goes through this dialog, which also offers the
 *  one-way-door option (quarantine) as an explicit, unchecked choice. */
export function DenyUserDialog({
  userId,
  email,
  action,
}: {
  userId: string
  email: string
  action: (formData: FormData) => Promise<void>
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="xs">
          Deny…
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deny this request?</DialogTitle>
          <DialogDescription>
            <span className="text-foreground">{email}</span> will receive an email saying their
            access request wasn&apos;t approved, and the account will be blocked.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="quarantine" className="mt-0.5" />
            <span>
              Also quarantine this email — it can&apos;t be used to sign up again. You can undo
              this later from the quarantine list on the Users page.
            </span>
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive">
              Deny request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
