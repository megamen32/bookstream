'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FeedSectionData } from './feed-types'
import { preloadSectionImages } from './chapter-images'

export interface ChapterLoaderState {
  sectionsByChapterId: Record<string, FeedSectionData | undefined>
  loadingIds: Record<string, boolean>
  failedIds: Record<string, boolean>
}

interface UseBackgroundChapterLoaderParams {
  chapterIds: string[]
  activeChapterId: string | null
  initialSections: FeedSectionData[]
  loadChapter: (chapterId: string, signal: AbortSignal) => Promise<FeedSectionData>
}

interface IdleDeadlineLike {
  didTimeout: boolean
  timeRemaining: () => number
}

type IdleScheduler = (callback: (deadline: IdleDeadlineLike) => void) => number

/**
 * Builds a preload queue that favors the active chapter and nearby neighbors.
 */
export function buildChapterPreloadQueue(params: {
  chapterIds: string[]
  activeChapterId: string
}): string[] {
  const activeIndex = params.chapterIds.indexOf(params.activeChapterId)
  if (activeIndex < 0) {
    return params.chapterIds
  }

  const result: string[] = []
  const used = new Set<string>()

  const push = (index: number): void => {
    const chapterId = params.chapterIds[index]
    if (!chapterId || used.has(chapterId)) {
      return
    }

    used.add(chapterId)
    result.push(chapterId)
  }

  push(activeIndex)
  push(activeIndex + 1)
  push(activeIndex - 1)
  push(activeIndex + 2)
  push(activeIndex - 2)
  push(activeIndex + 3)
  push(activeIndex - 3)

  for (let index = 0; index < params.chapterIds.length; index += 1) {
    push(index)
  }

  return result
}

function createIdleScheduler(): IdleScheduler {
  if ('requestIdleCallback' in window) {
    return (callback) => window.requestIdleCallback(callback)
  }

  return (callback) => window.setTimeout(
    () => callback({ didTimeout: false, timeRemaining: () => 16 }),
    120,
  )
}

/**
 * Loads chapters progressively in the background while keeping the initial reader usable.
 */
export function useBackgroundChapterLoader(params: UseBackgroundChapterLoaderParams): ChapterLoaderState & {
  ensureChapterLoaded: (chapterId: string) => Promise<FeedSectionData | null>
} {
  const [state, setState] = useState<ChapterLoaderState>(() => ({
    sectionsByChapterId: Object.fromEntries(
      params.initialSections.map((section) => [section.chapter.id, section]),
    ),
    loadingIds: {},
    failedIds: {},
  }))
  const loadedIdsRef = useRef(new Set(params.initialSections.map((section) => section.chapter.id)))
  const pendingRequestsRef = useRef(new Map<string, Promise<FeedSectionData | null>>())

  useEffect(() => {
    setState((current) => {
      const nextSections = { ...current.sectionsByChapterId }
      let changed = false

      for (const section of params.initialSections) {
        if (nextSections[section.chapter.id] !== section) {
          nextSections[section.chapter.id] = section
          loadedIdsRef.current.add(section.chapter.id)
          preloadSectionImages(section)
          changed = true
        }
      }

      return changed ? { ...current, sectionsByChapterId: nextSections } : current
    })
  }, [params.initialSections])

  const ensureChapterLoaded = useMemo(() => {
    return async (chapterId: string): Promise<FeedSectionData | null> => {
      if (!chapterId) {
        return null
      }

      const existing = state.sectionsByChapterId[chapterId]
      if (existing) {
        return existing
      }

      const pending = pendingRequestsRef.current.get(chapterId)
      if (pending) {
        return pending
      }

      const controller = new AbortController()

      setState((current) => ({
        ...current,
        loadingIds: {
          ...current.loadingIds,
          [chapterId]: true,
        },
      }))

      const request = params.loadChapter(chapterId, controller.signal)
        .then((section) => {
          loadedIdsRef.current.add(chapterId)
          preloadSectionImages(section)
          setState((current) => ({
            sectionsByChapterId: {
              ...current.sectionsByChapterId,
              [chapterId]: section,
            },
            loadingIds: {
              ...current.loadingIds,
              [chapterId]: false,
            },
            failedIds: {
              ...current.failedIds,
              [chapterId]: false,
            },
          }))
          return section
        })
        .catch((error: unknown) => {
          console.error(`Failed to load chapter ${chapterId}:`, error)
          setState((current) => ({
            ...current,
            loadingIds: {
              ...current.loadingIds,
              [chapterId]: false,
            },
            failedIds: {
              ...current.failedIds,
              [chapterId]: true,
            },
          }))
          return null
        })
        .finally(() => {
          pendingRequestsRef.current.delete(chapterId)
          controller.abort()
        })

      pendingRequestsRef.current.set(chapterId, request)
      return request
    }
  }, [params, state.sectionsByChapterId])

  useEffect(() => {
    if (!params.activeChapterId || params.chapterIds.length === 0) {
      return
    }

    const controller = new AbortController()
    const queue = buildChapterPreloadQueue({
      chapterIds: params.chapterIds,
      activeChapterId: params.activeChapterId,
    })
    const scheduleIdle = createIdleScheduler()
    let cancelled = false
    let activeRequests = 0
    let cursor = 0
    const maxParallel = 3

    const pump = (): void => {
      if (cancelled) {
        return
      }

      while (activeRequests < maxParallel && cursor < queue.length) {
        const chapterId = queue[cursor]
        cursor += 1

        if (
          !chapterId
          || loadedIdsRef.current.has(chapterId)
          || pendingRequestsRef.current.has(chapterId)
        ) {
          continue
        }

        activeRequests += 1

        setState((current) => ({
          ...current,
          loadingIds: {
            ...current.loadingIds,
            [chapterId]: true,
          },
        }))

        const request = params.loadChapter(chapterId, controller.signal)
          .then((section) => {
            if (cancelled) {
              return null
            }

            loadedIdsRef.current.add(chapterId)
            preloadSectionImages(section)
            setState((current) => ({
              sectionsByChapterId: {
                ...current.sectionsByChapterId,
                [chapterId]: section,
              },
              loadingIds: {
                ...current.loadingIds,
                [chapterId]: false,
              },
              failedIds: {
                ...current.failedIds,
                [chapterId]: false,
              },
            }))
            return section
          })
          .catch((error: unknown) => {
            if (!cancelled && !controller.signal.aborted) {
              console.error(`Failed to preload chapter ${chapterId}:`, error)
              setState((current) => ({
                ...current,
                loadingIds: {
                  ...current.loadingIds,
                  [chapterId]: false,
                },
                failedIds: {
                  ...current.failedIds,
                  [chapterId]: true,
                },
              }))
            }
            return null
          })
          .finally(() => {
            activeRequests -= 1
            pendingRequestsRef.current.delete(chapterId)
            if (!cancelled) {
              scheduleIdle(() => pump())
            }
          })

        pendingRequestsRef.current.set(chapterId, request)
      }
    }

    pump()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [params.activeChapterId, params.chapterIds, params.loadChapter])

  return {
    ...state,
    ensureChapterLoaded,
  }
}
