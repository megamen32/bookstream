'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

type LoadChapterFn = UseBackgroundChapterLoaderParams['loadChapter']

// Assign stable ids to callback identities so the pump can restart on real loader changes
// without depending on a raw function reference in the effect body.
const loadChapterIds = new WeakMap<LoadChapterFn, number>()
let nextLoadChapterId = 1

function getLoadChapterIdentity(loadChapter: LoadChapterFn): number {
  const existing = loadChapterIds.get(loadChapter)
  if (existing) {
    return existing
  }

  const nextId = nextLoadChapterId
  nextLoadChapterId += 1
  loadChapterIds.set(loadChapter, nextId)
  return nextId
}

function createInitialState(initialSections: FeedSectionData[]): ChapterLoaderState {
  return {
    sectionsByChapterId: Object.fromEntries(
      initialSections.map((section) => [section.chapter.id, section]),
    ),
    loadingIds: {},
    failedIds: {},
  }
}

function removeRecordKey(record: Record<string, boolean>, key: string): Record<string, boolean> {
  if (!(key in record)) {
    return record
  }

  const next = { ...record }
  delete next[key]
  return next
}

function getLoadedChapterIds(state: ChapterLoaderState): Set<string> {
  const result = new Set<string>()

  for (const [chapterId, section] of Object.entries(state.sectionsByChapterId)) {
    if (section) {
      result.add(chapterId)
    }
  }

  return result
}

function pruneStateForChapterIds(current: ChapterLoaderState, allowedChapterIds: Set<string>): ChapterLoaderState {
  let changed = false

  const sectionsByChapterId: Record<string, FeedSectionData | undefined> = {}
  for (const [chapterId, section] of Object.entries(current.sectionsByChapterId)) {
    if (allowedChapterIds.has(chapterId)) {
      sectionsByChapterId[chapterId] = section
    } else {
      changed = true
    }
  }

  const loadingIds: Record<string, boolean> = {}
  for (const chapterId of Object.keys(current.loadingIds)) {
    if (allowedChapterIds.has(chapterId) && current.loadingIds[chapterId]) {
      loadingIds[chapterId] = true
    } else {
      changed = true
    }
  }

  const failedIds: Record<string, boolean> = {}
  for (const chapterId of Object.keys(current.failedIds)) {
    if (allowedChapterIds.has(chapterId) && current.failedIds[chapterId]) {
      failedIds[chapterId] = true
    } else {
      changed = true
    }
  }

  if (!changed) {
    return current
  }

  return {
    sectionsByChapterId,
    loadingIds,
    failedIds,
  }
}

function markChapterLoading(current: ChapterLoaderState, chapterId: string): ChapterLoaderState {
  const loadingAlready = Boolean(current.loadingIds[chapterId])
  const failedAlready = Boolean(current.failedIds[chapterId])

  if (loadingAlready && !failedAlready) {
    return current
  }

  return {
    sectionsByChapterId: current.sectionsByChapterId,
    loadingIds: loadingAlready ? current.loadingIds : { ...current.loadingIds, [chapterId]: true },
    failedIds: failedAlready ? removeRecordKey(current.failedIds, chapterId) : current.failedIds,
  }
}

function markChapterFailed(current: ChapterLoaderState, chapterId: string): ChapterLoaderState {
  const loadingAlready = Boolean(current.loadingIds[chapterId])
  const failedAlready = Boolean(current.failedIds[chapterId])

  if (!loadingAlready && failedAlready) {
    return current
  }

  return {
    sectionsByChapterId: current.sectionsByChapterId,
    loadingIds: loadingAlready ? removeRecordKey(current.loadingIds, chapterId) : current.loadingIds,
    failedIds: failedAlready ? current.failedIds : { ...current.failedIds, [chapterId]: true },
  }
}

function markChapterLoaded(current: ChapterLoaderState, chapterId: string, section: FeedSectionData): ChapterLoaderState {
  const existingSection = current.sectionsByChapterId[chapterId]
  const loadingAlready = Boolean(current.loadingIds[chapterId])
  const failedAlready = Boolean(current.failedIds[chapterId])

  if (existingSection === section && !loadingAlready && !failedAlready) {
    return current
  }

  return {
    sectionsByChapterId: existingSection === section
      ? current.sectionsByChapterId
      : { ...current.sectionsByChapterId, [chapterId]: section },
    loadingIds: loadingAlready ? removeRecordKey(current.loadingIds, chapterId) : current.loadingIds,
    failedIds: failedAlready ? removeRecordKey(current.failedIds, chapterId) : current.failedIds,
  }
}

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
  const [state, setState] = useState<ChapterLoaderState>(() => createInitialState(params.initialSections))
  const stateRef = useRef(state)
  const loadedIdsRef = useRef(getLoadedChapterIds(state))
  const pendingRequestsRef = useRef(new Map<string, Promise<FeedSectionData | null>>())
  const latestChapterIdsRef = useRef(params.chapterIds)
  const latestLoadChapterRef = useRef(params.loadChapter)
  const generationRef = useRef(0)
  const signatureRef = useRef('')

  const commitState = useCallback((nextState: ChapterLoaderState): void => {
    if (Object.is(nextState, stateRef.current)) {
      return
    }

    stateRef.current = nextState
    setState(nextState)
  }, [])

  const chapterIdsSignature = JSON.stringify(params.chapterIds)
  const loadChapterSignature = getLoadChapterIdentity(params.loadChapter)
  const restartSignature = `${chapterIdsSignature}\u0001${params.activeChapterId || ''}\u0001${loadChapterSignature}`

  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  useLayoutEffect(() => {
    latestChapterIdsRef.current = params.chapterIds
  }, [params.chapterIds])

  useLayoutEffect(() => {
    latestLoadChapterRef.current = params.loadChapter
  }, [params.loadChapter])

  useLayoutEffect(() => {
    if (signatureRef.current === restartSignature) {
      return
    }

    // Bump the generation before passive effects run so late async completions from the
    // previous book/chapter set cannot write into the new state.
    signatureRef.current = restartSignature
    generationRef.current += 1
  }, [commitState, restartSignature])

  useLayoutEffect(() => {
    // Drop chapters that no longer belong to the current signature before preload work resumes.
    const allowedChapterIds = new Set(params.chapterIds)
    const currentState = stateRef.current
    let nextState = pruneStateForChapterIds(currentState, allowedChapterIds)
    const changedSections = params.initialSections.filter((section) => nextState.sectionsByChapterId[section.chapter.id] !== section)

    if (changedSections.length > 0) {
      for (const section of changedSections) {
        loadedIdsRef.current.add(section.chapter.id)
        preloadSectionImages(section)
      }

      for (const section of changedSections) {
        nextState = markChapterLoaded(nextState, section.chapter.id, section)
      }
    }

    loadedIdsRef.current = getLoadedChapterIds(nextState)
    commitState(nextState)
  }, [chapterIdsSignature, commitState, params.initialSections])

  const ensureChapterLoaded = useCallback(async (chapterId: string): Promise<FeedSectionData | null> => {
    if (!chapterId) {
      return null
    }

    const existing = stateRef.current.sectionsByChapterId[chapterId]
    if (existing) {
      return existing
    }

    const requestGeneration = generationRef.current
    const requestKey = `${requestGeneration}:${chapterId}`
    const pending = pendingRequestsRef.current.get(requestKey)
    if (pending) {
      return pending
    }

    const controller = new AbortController()
    const request = latestLoadChapterRef.current(chapterId, controller.signal)
      .then((section) => {
        if (controller.signal.aborted || generationRef.current !== requestGeneration) {
          return null
        }

        loadedIdsRef.current.add(chapterId)
        preloadSectionImages(section)
        commitState(markChapterLoaded(stateRef.current, chapterId, section))
        return section
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && generationRef.current === requestGeneration) {
          console.error(`Failed to load chapter ${chapterId}:`, error)
          commitState(markChapterFailed(stateRef.current, chapterId))
        }
        return null
      })
      .finally(() => {
        pendingRequestsRef.current.delete(requestKey)
        controller.abort()
      })

    pendingRequestsRef.current.set(requestKey, request)
    commitState(markChapterLoading(stateRef.current, chapterId))
    return request
  }, [commitState])

  useEffect(() => {
    if (!params.activeChapterId || params.chapterIds.length === 0) {
      return
    }

    const requestGeneration = generationRef.current
    const controller = new AbortController()
    const queue = buildChapterPreloadQueue({
      chapterIds: latestChapterIdsRef.current,
      activeChapterId: params.activeChapterId,
    })
    const scheduleIdle = createIdleScheduler()
    let cancelled = false
    let activeRequests = 0
    let cursor = 0
    const maxParallel = 3

    const pump = (): void => {
      if (cancelled || generationRef.current !== requestGeneration) {
        return
      }

      while (activeRequests < maxParallel && cursor < queue.length) {
        const chapterId = queue[cursor]
        cursor += 1

        if (
          !chapterId
          || loadedIdsRef.current.has(chapterId)
          || stateRef.current.loadingIds[chapterId]
          || pendingRequestsRef.current.has(`${requestGeneration}:${chapterId}`)
        ) {
          continue
        }

        activeRequests += 1

        const requestKey = `${requestGeneration}:${chapterId}`
        const request = latestLoadChapterRef.current(chapterId, controller.signal)
          .then((section) => {
            if (cancelled || controller.signal.aborted || generationRef.current !== requestGeneration) {
              return null
            }

            loadedIdsRef.current.add(chapterId)
            preloadSectionImages(section)
            commitState(markChapterLoaded(stateRef.current, chapterId, section))
            return section
          })
          .catch((error: unknown) => {
            if (!cancelled && !controller.signal.aborted && generationRef.current === requestGeneration) {
              console.error(`Failed to preload chapter ${chapterId}:`, error)
              commitState(markChapterFailed(stateRef.current, chapterId))
            }
            return null
          })
          .finally(() => {
            activeRequests -= 1
            pendingRequestsRef.current.delete(requestKey)
            if (!cancelled && generationRef.current === requestGeneration) {
              scheduleIdle(() => pump())
            }
          })

        pendingRequestsRef.current.set(requestKey, request)
        commitState(markChapterLoading(stateRef.current, chapterId))
      }
    }

    pump()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [commitState, restartSignature])

  return {
    ...state,
    ensureChapterLoaded,
  }
}
