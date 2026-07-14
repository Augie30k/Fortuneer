import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, color-mix(in oklch, var(--secondary), transparent 82%), transparent 45%), radial-gradient(circle at 85% 85%, color-mix(in oklch, var(--primary), transparent 90%), transparent 40%)',
        }}
      />
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-1 font-serif text-3xl font-bold tracking-wide"
        >
          <span className="text-foreground">FORT</span>
          <span className="text-primary">UNEER</span>
        </Link>
        {children}
      </div>
    </div>
  )
}
