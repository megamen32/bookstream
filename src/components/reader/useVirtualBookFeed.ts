'use client'

import { useCallback, useLayoutEffect, useMemo, useState } from 'react'

export interface VirtualChapter<TSection> {
  chapterId: string
  position: number
  title: string
  estimatedHeight: number
  measuredHeight?: number
  offsetTop: number
  status: 'stub' | 'loading' | 'ready' | 'error'
  section?: TSection
}

interface VirtualChapterInput<TSection> {
  chapterId: string
  position: number
  title: string
  estimatedHeight: number
  status: 'stub' | 'loading' | 'ready' | 'error'
  section?: TSection
}

interface UseVirtualBookFeedOptions<TSection> {
  chapters: VirtualChapterInput<TSection>[]
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  overscanScreens?: number
}

interface LayoutAccumulator<TSection> {
  items: Array<VirtualChapter<TSection>>
  totalHeight: number
}

function findIndexAtOffset<TSection>(items: Array<VirtualChapter<TSection>>, offset: number): number {
  if (items.length === 0) {
    return 0
  }

  let low = 0
  let high = items.length - 1
  let result = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const item = items[mid]
    const itemHeight = item.measuredHeight || item.estimatedHeight
    const itemBottom = item.offsetTop + itemHeight

    if (itemBottom >= offset) {
      result = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }

  return result
}

/**
 * Resolves the active chapter from the virtual book layout rather than DOM offsets.
 */
export function resolveActiveChapterFromVirtualLayout<TSection>(params: {
  items: Array<VirtualChapter<TSection>>
  scrollTop: number
  viewportHeight: number
}): string | null {
  const threshold = params.scrollTop + params.viewportHeight * 0.22
  let activeId = params.items[0]?.chapterId || null

  for (const item of params.items) {
    if (item.offsetTop <= threshold) {
      activeId = item.chapterId
    } else {
      break
    }
  }

  return activeId
}

/**
 * Maintains a virtual full-book scroll surface while mounting only nearby chapters.
 */
export function useVirtualBookFeed<TSection>({
  chapters,
  scrollContainerRef,
  overscanScreens = 2.5,
}: UseVirtualBookFeedOptions<TSection>) {
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({})
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(900)

  const layout = useMemo(() => {
    return chapters.reduce<LayoutAccumulator<TSection>>((accumulator, chapter) => {
      const measuredHeight = measuredHeights[chapter.chapterId]
      const item: VirtualChapter<TSection> = {
        ...chapter,
        measuredHeight,
        offsetTop: accumulator.totalHeight,
      }

      const nextTotalHeight = accumulator.totalHeight + (measuredHeight || chapter.estimatedHeight)

      return {
        items: [...accumulator.items, item],
        totalHeight: nextTotalHeight,
      }
    }, { items: [], totalHeight: 0 })
  }, [chapters, measuredHeights])

  const visibleRange = useMemo(() => {
    if (layout.items.length === 0) {
      return { firstIndex: 0, lastIndex: -1 }
    }

    const buffer = viewportHeight * overscanScreens
    const start = Math.max(0, scrollTop - buffer)
    const end = scrollTop + viewportHeight + buffer
    const firstIndex = findIndexAtOffset(layout.items, start)
    let lastIndex = firstIndex

    for (let index = firstIndex; index < layout.items.length; index += 1) {
      const item = layout.items[index]
      if (item.offsetTop > end) {
        break
      }
      lastIndex = index
    }

    return { firstIndex, lastIndex }
  }, [layout.items, overscanScreens, scrollTop, viewportHeight])

  const visibleChapters = useMemo(() => {
    if (visibleRange.lastIndex < visibleRange.firstIndex) {
      return []
    }

    return layout.items.slice(visibleRange.firstIndex, visibleRange.lastIndex + 1)
  }, [layout.items, visibleRange.firstIndex, visibleRange.lastIndex])

  const topSpacerHeight = visibleChapters[0]?.offsetTop || 0
  const lastVisible = visibleChapters[visibleChapters.length - 1]
  const lastVisibleBottom = lastVisible
    ? lastVisible.offsetTop + (lastVisible.measuredHeight || lastVisible.estimatedHeight)
    : 0
  const bottomSpacerHeight = Math.max(0, layout.totalHeight - lastVisibleBottom)

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    setScrollTop(container.scrollTop)
    setViewportHeight(container.clientHeight)
  }, [scrollContainerRef])

  const registerMeasuredHeight = useCallback((chapterId: string, newHeight: number) => {
    const container = scrollContainerRef.current
    const item = layout.items.find((entry) => entry.chapterId === chapterId)
    if (!container || !item) {
      return
    }

    const oldHeight = item.measuredHeight || item.estimatedHeight
    if (Math.abs(oldHeight - newHeight) < 8) {
      return
    }

    const delta = newHeight - oldHeight
    setMeasuredHeights((current) => ({
      ...current,
      [chapterId]: newHeight,
    }))

    if (item.offsetTop < container.scrollTop) {
      container.scrollTop += delta
      setScrollTop(container.scrollTop)
    }
  }, [layout.items, scrollContainerRef])

  const scrollToChapter = useCallback((chapterId: string, behavior: ScrollBehavior = 'auto') => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    const target = layout.items.find((item) => item.chapterId === chapterId)
    if (!target) {
      return
    }

    container.scrollTo({
      top: target.offsetTop,
      behavior,
    })
    setScrollTop(target.offsetTop)
  }, [layout.items, scrollContainerRef])

  const getChapterProgress = useCallback((chapterId: string): number => {
    const index = layout.items.findIndex((item) => item.chapterId === chapterId)
    if (index < 0) {
      return 0
    }

    const item = layout.items[index]
    const nextItem = layout.items[index + 1]
    const sectionBottom = nextItem ? nextItem.offsetTop : layout.totalHeight
    const sectionHeight = Math.max(1, sectionBottom - item.offsetTop - viewportHeight * 0.2)

    return Math.min(Math.max((scrollTop - item.offsetTop) / sectionHeight, 0), 1)
  }, [layout.items, layout.totalHeight, scrollTop, viewportHeight])

  const getRestoreOffset = useCallback((chapterId: string, scrollPercent: number): number | null => {
    const index = layout.items.findIndex((item) => item.chapterId === chapterId)
    if (index < 0) {
      return null
    }

    const item = layout.items[index]
    const nextItem = layout.items[index + 1]
    const sectionBottom = nextItem ? nextItem.offsetTop : layout.totalHeight
    const travel = Math.max(0, sectionBottom - item.offsetTop - viewportHeight * 0.2)

    return item.offsetTop + travel * scrollPercent
  }, [layout.items, layout.totalHeight, viewportHeight])

  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    setScrollTop(container.scrollTop)
    setViewportHeight(container.clientHeight)

    const resizeObserver = new ResizeObserver(() => {
      setViewportHeight(container.clientHeight)
    })
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [scrollContainerRef])

  return {
    totalHeight: layout.totalHeight,
    items: layout.items,
    topSpacerHeight,
    bottomSpacerHeight,
    visibleChapters,
    handleScroll,
    registerMeasuredHeight,
    scrollToChapter,
    getRestoreOffset,
    getChapterProgress,
  }
}
