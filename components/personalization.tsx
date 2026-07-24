'use client'

import { createContext, useContext } from 'react'
import type { Persona } from '@/lib/types'

/** Choices made during first-login onboarding, served to every dashboard page
 *  by the (dashboard) layout so greetings/nav/tips can tailor themselves
 *  without each page refetching the profile. */
export type Personalization = {
  preferredName: string | null
  persona: Persona | null
  focusAreas: string[]
}

const PersonalizationContext = createContext<Personalization>({
  preferredName: null,
  persona: null,
  focusAreas: [],
})

export function PersonalizationProvider({
  value,
  children,
}: {
  value: Personalization
  children: React.ReactNode
}) {
  return <PersonalizationContext.Provider value={value}>{children}</PersonalizationContext.Provider>
}

export function usePersonalization() {
  return useContext(PersonalizationContext)
}
