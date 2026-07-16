import { useColorScheme } from 'react-native'

/** Minimal theme-aware palette until the app gets a real design pass. */
export function usePalette() {
  const dark = useColorScheme() === 'dark'
  return {
    text: dark ? '#e5e5ea' : '#1c1c1e',
    muted: '#8a8a8e',
    inputBg: dark ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)',
    border: 'rgba(120,120,128,0.4)',
    hairline: 'rgba(120,120,128,0.3)',
    accent: '#208AEF',
    danger: '#ff453a',
    positive: dark ? '#30d158' : '#248a3d',
  }
}
