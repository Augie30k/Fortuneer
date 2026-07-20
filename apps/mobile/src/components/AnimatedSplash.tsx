import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import Animated, { Easing, runOnJS, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'

import HeroGraphic from '@/components/HeroGraphic'
import { usePalette } from '@/lib/theme'

// Minimum time the JS hero is on screen, so it reads as an intentional
// branded moment rather than a flicker on fast (cached-session) cold starts.
const MIN_VISIBLE_MS = 1000
const FADE_MS = 420

/** Full-bleed hero graphic shown right after the native launch screen hides,
 *  cross-fading into the real app once auth state is ready. Sits as a
 *  sibling on top of the already-mounted navigator so the reveal underneath
 *  is instant when this fades out. */
export default function AnimatedSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const palette = usePalette()
  const opacity = useSharedValue(1)
  const scale = useSharedValue(1)

  useEffect(() => {
    // The native static splash is still covering the screen at first paint —
    // hide it now so this animated hero takes over with no blank frame.
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) })
      scale.value = withTiming(
        1.04,
        { duration: FADE_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onFinish)()
        }
      )
    }, MIN_VISIBLE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }, animatedStyle]}
    >
      <HeroGraphic />
    </Animated.View>
  )
}
