import type { Metadata } from 'next'
import './globals.css'
import { DM_Sans, EB_Garamond } from 'next/font/google'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/sonner'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })
const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
})

export const metadata: Metadata = {
  title: 'Fortuneer',
  description: 'Pioneer Your Wealth',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn('font-sans', dmSans.variable, ebGaramond.variable)}>
      <body>
        {children}
        <Toaster theme="dark" richColors />
      </body>
    </html>
  )
}