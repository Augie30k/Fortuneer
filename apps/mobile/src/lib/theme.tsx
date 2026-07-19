import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'

/** iOS-system-styled palette, resolved per color scheme. Screens must use
 *  this (never hardcoded grays) so light mode always renders correctly. */
export interface Palette {
  dark: boolean
  /** Grouped-list screen background (system grouped background) */
  bg: string
  /** Card / elevated surface background */
  card: string
  text: string
  muted: string
  /** Even fainter than muted — timestamps, tertiary labels */
  faint: string
  inputBg: string
  border: string
  hairline: string
  accent: string
  accentSoft: string
  danger: string
  positive: string
  /** Ranked chart palette for category fallbacks (matches web's diverse hues) */
  chart: string[]
}

const LIGHT: Palette = {
  dark: false,
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  muted: '#8A8A8E',
  faint: '#AEAEB2',
  inputBg: 'rgba(120,120,128,0.12)',
  border: 'rgba(120,120,128,0.3)',
  hairline: 'rgba(120,120,128,0.22)',
  accent: '#208AEF',
  accentSoft: 'rgba(32,138,239,0.12)',
  danger: '#D70015',
  positive: '#248A3D',
  chart: ['#FF9500', '#FF375F', '#AF52DE', '#E8A200', '#30B0C7', '#0A84FF', '#C2703D'],
}

const DARK: Palette = {
  ...LIGHT,
  dark: true,
  bg: '#000000',
  card: '#1C1C1E',
  text: '#E5E5EA',
  muted: '#8A8A8E',
  faint: '#636366',
  inputBg: 'rgba(120,120,128,0.24)',
  border: 'rgba(120,120,128,0.42)',
  hairline: 'rgba(120,120,128,0.3)',
  accentSoft: 'rgba(32,138,239,0.22)',
  danger: '#FF453A',
  positive: '#30D158',
}

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'fortuneer.theme.mode'

/** Mirrors web's manual dark/light override (ThemeToggle + localStorage
 *  'theme') — defaults to following the system setting until the user
 *  picks one explicitly, persisted so it survives app restarts. */
const ThemeModeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>({
  mode: 'system',
  setMode: () => {},
})

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved)
    })
  }, [])

  const setMode = (next: ThemeMode) => {
    setModeState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
  }

  return <ThemeModeContext.Provider value={{ mode, setMode }}>{children}</ThemeModeContext.Provider>
}

export function useThemeMode() {
  return useContext(ThemeModeContext)
}

export function usePalette(): Palette {
  const system = useColorScheme()
  const { mode } = useThemeMode()
  const dark = mode === 'system' ? system === 'dark' : mode === 'dark'
  return dark ? DARK : LIGHT
}
