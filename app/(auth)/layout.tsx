import Link from 'next/link'
import Logo from '@/components/Logo'
import HeroGraphic from '@/components/HeroGraphic'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-[56%]">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex justify-center">
            <Logo />
          </Link>
          {children}
        </div>
      </div>
      <div className="hidden lg:block lg:w-[44%]">
        <HeroGraphic />
      </div>
    </div>
  )
}
