'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import HeroGraphic from '@/components/HeroGraphic'
import { cn } from '@/lib/utils'

// How long the full-bleed hero splash holds before dissolving into the real
// screen underneath, so it reads as an intentional branded moment rather
// than a flicker — mirrors the mobile app's AnimatedSplash
// (apps/mobile/src/components/AnimatedSplash.tsx).
const SPLASH_MIN_VISIBLE_MS = 1300

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [splashVisible, setSplashVisible] = useState(true)
  const [splashFading, setSplashFading] = useState(false)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(
      () => (reducedMotion ? setSplashVisible(false) : setSplashFading(true)),
      reducedMotion ? 0 : SPLASH_MIN_VISIBLE_MS
    )
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex w-full animate-[ft-form-in_0.5s_ease-out_both] items-center justify-center px-4 py-12 lg:w-[56%]">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex justify-center">
            <Logo />
          </Link>
          {children}
        </div>
      </div>
      <div className="hidden animate-[ft-panel-in_0.6s_ease-out_both] lg:block lg:w-[44%]">
        <HeroGraphic />
      </div>

      {splashVisible && (
        <div
          className={cn(
            'fixed inset-0 z-50 bg-background',
            splashFading && 'animate-[ft-splash-out_420ms_ease-out_both]'
          )}
          onAnimationEnd={(e) => {
            if (e.animationName === 'ft-splash-out') setSplashVisible(false)
          }}
        >
          <HeroGraphic />
        </div>
      )}
    </div>
  )
}
