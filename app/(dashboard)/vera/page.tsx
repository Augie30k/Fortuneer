'use client'

import { useRouter } from 'next/navigation'
import { Minimize2 } from 'lucide-react'
import VeraChat from '@/components/vera/VeraChat'
import { Button } from '@/components/ui/button'

export default function VeraPage() {
  const router = useRouter()

  // Goes back to wherever the user came from — no need to hunt for a
  // sidebar link just to get out of the full-page view
  const minimize = () => {
    if (window.history.length > 1) router.back()
    else router.push('/dashboard')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon-sm" onClick={minimize} aria-label="Minimize Vera">
          <Minimize2 />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Vera</h1>
          <p className="text-sm text-muted-foreground">
            Your straight-talking money co-pilot — ask anything, or tell her what to change
          </p>
        </div>
      </div>
      <VeraChat fullPage />
    </div>
  )
}
