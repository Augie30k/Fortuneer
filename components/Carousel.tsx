'use client'

import { Children, cloneElement, isValidElement, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/** Roughly how long each item gets on screen — sets a consistent pace
 *  regardless of how many items are in the track. */
const SECONDS_PER_ITEM = 3.2
const MIN_DURATION_S = 8

/**
 * Continuous, seamless ticker — items flow right-to-left at a constant
 * speed with no start or end, like a news channel crawl, rather than
 * jumping between fixed positions. The track is rendered twice back-to-back
 * and animated by exactly one copy-width (-50%), so the loop point is
 * invisible. Pauses on hover so a specific item can be read.
 */
export default function Carousel({
  children,
  itemCount,
  className,
}: {
  children: React.ReactNode
  /** Number of items in the track, for pacing the animation */
  itemCount: number
  className?: string
}) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  if (reducedMotion) {
    return (
      <div
        className={cn(
          'flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          className
        )}
      >
        {children}
      </div>
    )
  }

  const duration = Math.max(MIN_DURATION_S, itemCount * SECONDS_PER_ITEM)
  // Duplicate the track for a seamless loop — re-keyed so React doesn't see
  // the same key twice across the two copies
  const items = Children.toArray(children)
  const duplicate = items.map((child) =>
    isValidElement(child) ? cloneElement(child, { key: `dup-${child.key}` }) : child
  )

  return (
    <div className={cn('overflow-hidden', className)}>
      <div
        className="flex w-max [&>*]:mr-3 hover:[animation-play-state:paused]"
        style={{ animation: `marquee ${duration}s linear infinite` }}
      >
        {items}
        {duplicate}
      </div>
    </div>
  )
}
