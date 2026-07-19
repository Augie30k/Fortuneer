import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'

interface LoadState<T> {
  data: T | null
  loading: boolean
  refreshing: boolean
  error: string | null
}

/** Standard screen data-loading: initial spinner, pull-to-refresh, silent
 *  refetch when the screen regains focus (so edits made on pushed/modal
 *  screens show up on return), and refetch when `deps` change. */
export function useLoad<T>(
  fn: () => Promise<T>,
  deps: readonly unknown[] = [],
  opts: { refetchOnFocus?: boolean } = {}
) {
  const { refetchOnFocus = true } = opts
  const [state, setState] = useState<LoadState<T>>({
    data: null,
    loading: true,
    refreshing: false,
    error: null,
  })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const hasLoaded = useRef(false)

  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    if (mode === 'initial') setState((s) => ({ ...s, loading: true, error: null }))
    if (mode === 'refresh') setState((s) => ({ ...s, refreshing: true }))
    try {
      const data = await fnRef.current()
      hasLoaded.current = true
      setState({ data, loading: false, refreshing: false, error: null })
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        refreshing: false,
        // Keep stale data on silent/refresh failures; only surface the error text
        error: e instanceof Error ? e.message : 'Something went wrong',
      }))
    }
  }, [])

  useEffect(() => {
    run(hasLoaded.current ? 'silent' : 'initial')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus && hasLoaded.current) run('silent')
    }, [refetchOnFocus, run])
  )

  const refresh = useCallback(() => run('refresh'), [run])
  const reload = useCallback(() => run('initial'), [run])

  return { ...state, refresh, reload }
}
