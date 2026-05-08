'use client'

import { useLayoutEffect, useRef } from 'react'

interface UseInitialScrollLockParams {
  scrollRef: React.RefObject<HTMLDivElement | null>
  ready: boolean
  targetOffset: number | null
  onDone?: () => void
}

/**
 * Applies the initial reader position without visible scroll animation or jumps.
 */
export function useInitialScrollLock(params: UseInitialScrollLockParams): void {
  const appliedRef = useRef(false)
  const { scrollRef, ready, targetOffset, onDone } = params

  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container || !ready || targetOffset === null || appliedRef.current) {
      return
    }

    appliedRef.current = true
    const element = container

    const previousOverflowY = element.style.overflowY
    const previousScrollBehavior = element.style.scrollBehavior
    let unlocked = false

    const unlock = (): void => {
      if (unlocked) {
        return
      }

      unlocked = true
      element.style.overflowY = previousOverflowY || 'auto'
      element.style.scrollBehavior = previousScrollBehavior || ''
      onDone?.()
    }

    element.style.overflowY = 'hidden'
    element.style.scrollBehavior = 'auto'
    element.scrollTop = targetOffset

    let frame2 = 0
    const frame1 = window.requestAnimationFrame(() => {
      element.scrollTop = targetOffset
      frame2 = window.requestAnimationFrame(() => {
        element.scrollTop = targetOffset
        unlock()
      })
    })

    const hardTimer = window.setTimeout(unlock, 2000)

    return () => {
      window.cancelAnimationFrame(frame1)
      window.cancelAnimationFrame(frame2)
      window.clearTimeout(hardTimer)
      unlock()
    }
  }, [onDone, ready, scrollRef, targetOffset])
}
