'use client'

import { useLayoutEffect, useRef } from 'react'
import type React from 'react'

interface MeasuredChapterProps extends React.HTMLAttributes<HTMLElement> {
  chapterId: string
  onMeasure: (chapterId: string, height: number) => void
}

/**
 * Measures mounted chapter height and reports updates to the virtual layout.
 */
export default function MeasuredChapter({
  chapterId,
  onMeasure,
  children,
  ...rest
}: MeasuredChapterProps) {
  const ref = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) {
      return
    }

    const measure = (): void => {
      onMeasure(chapterId, node.offsetHeight)
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(node)

    return () => observer.disconnect()
  }, [chapterId, onMeasure])

  return (
    <section ref={ref} {...rest}>
      {children}
    </section>
  )
}
