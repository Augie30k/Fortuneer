import Link from 'next/link'
import Logo from '@/components/Logo'
import TermsContent from '@/components/legal/TermsContent'

export const metadata = { title: 'Terms & Conditions — Fortuneer' }

/** Public, read-only Terms & Conditions — linked from signup and Settings.
 *  Acceptance itself is recorded at signup and on /terms/accept. */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <TermsContent />
        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
