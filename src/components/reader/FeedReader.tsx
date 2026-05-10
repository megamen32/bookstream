'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type React from 'react'
import { useReaderStore } from '@/lib/store'
import './FeedReader.css'
import TextSelector from './TextSelector'
import type { SelectionAnnotationRange } from './TextSelector'
import type { ReaderComment } from './comment-types'
import type { BookChapterManifestItem, FeedSectionData } from './feed-types'
import { findQuoteParagraphElement, scrollQuoteTargetIntoView } from '@/lib/quote-navigation'
import { collectParagraphRangeElements } from '@/lib/paragraph-selection'
import {
  buildAnnotationParagraphRanges,
  type AnnotationParagraphRange,
  type UnifiedAnnotationItem,
} from '@/lib/annotations'
import { estimateChapterHeight } from './chapter-height'
import ChapterSkeleton from './ChapterSkeleton'
import MeasuredChapter from './MeasuredChapter'
import ReaderChapterSection from './ReaderChapterSection'
import { useBackgroundChapterLoader } from './useBackgroundChapterLoader'
import { resolveActiveChapterFromVirtualLayout, useVirtualBookFeed } from './useVirtualBookFeed'
import { useInitialScrollLock } from './useInitialScrollLock'

interface FeedReaderProps {
  bookId: string
  manifest: BookChapterManifestItem[]
  initialSections: FeedSectionData[]
  activeChapterId: string | null
  loadChapter: (chapterId: string, signal: AbortSignal) => Promise<FeedSectionData>
  onActiveChapterChange: (chapterId: string, scrollPercent: number, fromScroll: boolean) => void
  setContentNode?: (node: HTMLDivElement | null) => void
  bookmarkedKeys: Record<string, string | undefined>
  onToggleBookmark?: (chapterId: string, stableKey: string) => void
  authorSlug: string
  bookSlug: string
  onSendComment?: (body: string) => Promise<ReaderComment | null>
  showCommentsAfterChapter?: boolean
  showReactionBar?: boolean
  highlightParagraphId?: string | null
  highlightParagraphEndId?: string | null
  highlightStartOffset?: number | null
  highlightEndOffset?: number | null
  focusParagraphId?: string | null
  focusParagraphEndId?: string | null
  focusStartOffset?: number | null
  focusEndOffset?: number | null
  onQuoteFocusHandled?: () => void
  restoreRequest?: { chapterId: string; scrollPercent: number; token: number } | null
  scrollToChapterId?: string | null
  onScrollToChapterHandled?: () => void
  composerOpenChapterId?: string | null
  composerOpenRequest?: number
  onSurfaceTap?: () => void
  onNavigate?: () => void
}

interface StoredSelectionAnnotationRange extends SelectionAnnotationRange {
  chapterId?: string
}

interface PointerGestureState {
  pointerId: number
  pointerType: string
  clientX: number
  clientY: number
}

type VirtualStatus = 'stub' | 'loading' | 'ready' | 'error'

/**
 * Waits until the quote target paragraph is mounted inside the scroll container.
 */
async function waitForQuoteTarget(
  container: HTMLDivElement,
  paragraphId: string,
  maxFrames: number = 24,
): Promise<HTMLElement | null> {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const target = findQuoteParagraphElement(container, paragraphId)
    if (target) {
      return target
    }

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve())
    })
  }

  return null
}

export default function FeedReader({
  bookId,
  manifest,
  initialSections,
  activeChapterId,
  loadChapter,
  onActiveChapterChange,
  setContentNode,
  bookmarkedKeys,
  onToggleBookmark,
  authorSlug,
  bookSlug,
  onSendComment,
  showCommentsAfterChapter = true,
  showReactionBar = true,
  highlightParagraphId,
  highlightParagraphEndId,
  highlightStartOffset,
  highlightEndOffset,
  focusParagraphId,
  focusParagraphEndId,
  focusStartOffset,
  focusEndOffset,
  onQuoteFocusHandled,
  restoreRequest,
  scrollToChapterId,
  onScrollToChapterHandled,
  composerOpenChapterId,
  composerOpenRequest = 0,
  onSurfaceTap,
  onNavigate,
}: FeedReaderProps) {
  const { fontSize, lineHeight, lineWidth, readerId, showMobileReactionBar } = useReaderStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const quoteHighlightNodesRef = useRef<HTMLElement[]>([])
  const quoteFocusPulseNodesRef = useRef<HTMLElement[]>([])
  const quoteFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHandledQuoteFocusKeyRef = useRef<string | null>(null)
  const restoreAppliedTokenRef = useRef<number | null>(null)
  const tickingRef = useRef(false)
  const pointerGestureRef = useRef<PointerGestureState | null>(null)
  const initialRevealSetRef = useRef(false)

  const [selectionHighlights, setSelectionHighlights] = useState<StoredSelectionAnnotationRange[]>([])
  const [initialRevealChapterId, setInitialRevealChapterId] = useState<string | null>(null)
  const [initialScrollReady, setInitialScrollReady] = useState(false)

  const hasPreciseQuoteHighlight = Number.isFinite(highlightStartOffset) && Number.isFinite(highlightEndOffset)
  const chapterIds = useMemo(() => manifest.map((item) => item.chapterId), [manifest])

  const chapterLoader = useBackgroundChapterLoader({
    chapterIds,
    activeChapterId: activeChapterId || manifest[0]?.chapterId || null,
    initialSections,
    loadChapter,
  })

  const loadedSections = useMemo(() => {
    return Object.values(chapterLoader.sectionsByChapterId)
      .filter((section): section is FeedSectionData => Boolean(section))
      .sort((a, b) => a.chapter.position - b.chapter.position)
  }, [chapterLoader.sectionsByChapterId])

  const loadedParagraphIndexMaps = useMemo(() => (
    Object.fromEntries(
      loadedSections.map((section) => [
        section.chapter.id,
        new Map(section.variant.paragraphs.map((paragraph, index) => [paragraph.id, index])),
      ]),
    ) as Record<string, Map<string, number>>
  ), [loadedSections])

  const hasPreciseFocusQuote = Number.isFinite(focusStartOffset) && Number.isFinite(focusEndOffset)

  const quoteHighlightRangesByChapter = useMemo(() => {
    if (!highlightParagraphId || !hasPreciseQuoteHighlight) {
      return {}
    }

    const section = loadedSections.find((entry) => entry.variant.paragraphs.some((paragraph) => paragraph.id === highlightParagraphId))
    if (!section) {
      return {}
    }

    const paragraphIndexMap = loadedParagraphIndexMaps[section.chapter.id]
    if (!paragraphIndexMap) {
      return {}
    }

    const ranges = buildAnnotationParagraphRanges(
      [{
        kind: 'quote',
        paragraphId: highlightParagraphId,
        endParagraphId: highlightParagraphEndId || highlightParagraphId,
        startOffset: Number(highlightStartOffset),
        endOffset: Number(highlightEndOffset),
        selectedText: null,
        emoji: null,
      }],
      section.variant.paragraphs,
      paragraphIndexMap,
    )

    return {
      [section.chapter.id]: ranges,
    }
  }, [
    hasPreciseQuoteHighlight,
    highlightEndOffset,
    highlightParagraphEndId,
    highlightParagraphId,
    highlightStartOffset,
    loadedParagraphIndexMaps,
    loadedSections,
  ])

  useEffect(() => {
    if (!readerId || !bookId) {
      return
    }

    const controller = new AbortController()

    const loadSelectionHighlights = async (): Promise<void> => {
      try {
        const params = new URLSearchParams({ readerId, bookId })
        const response = await fetch(`/api/annotations?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          return
        }

        const data = await response.json() as {
          annotations?: UnifiedAnnotationItem[]
        }

        const loaded = (Array.isArray(data.annotations) ? data.annotations : [])
          .map<StoredSelectionAnnotationRange>((annotation) => ({
            id: annotation.id,
            kind: annotation.kind,
            chapterId: annotation.chapterId,
            paragraphId: annotation.paragraphId || '',
            endParagraphId: annotation.endParagraphId || annotation.paragraphId || '',
            startOffset: Number.isFinite(annotation.startOffset) ? annotation.startOffset : 0,
            endOffset: Number.isFinite(annotation.endOffset) ? annotation.endOffset : 0,
            selectedText: annotation.selectedText || '',
            emoji: annotation.emoji,
            body: annotation.body,
          }))

        setSelectionHighlights(loaded)
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load selection highlights:', error)
        }
      }
    }

    void loadSelectionHighlights()

    return () => controller.abort()
  }, [readerId, bookId])

  const handleSelectionAnnotation = useCallback((range: SelectionAnnotationRange, active: boolean) => {
    const candidate: StoredSelectionAnnotationRange = {
      ...range,
      chapterId: range.chapterId,
    }

    setSelectionHighlights((current) => {
      const isSame = (entry: StoredSelectionAnnotationRange) => (
        entry.kind === candidate.kind
        && entry.chapterId === candidate.chapterId
        && entry.paragraphId === candidate.paragraphId
        && entry.endParagraphId === candidate.endParagraphId
        && entry.startOffset === candidate.startOffset
        && entry.endOffset === candidate.endOffset
        && entry.emoji === candidate.emoji
        && entry.body === candidate.body
      )

      if (!active) {
        return current.filter((entry) => !isSame(entry))
      }

      return current.some(isSame) ? current : [...current, candidate]
    })
  }, [])

  const getTextRangesForParagraph = useCallback((
    chapterId: string,
    paragraphId: string,
  ): AnnotationParagraphRange[] => {
    const section = loadedSections.find((entry) => entry.chapter.id === chapterId)
    const paragraphIndexMap = loadedParagraphIndexMaps[chapterId]

    if (!section || !paragraphIndexMap) {
      return []
    }

    const ranges = buildAnnotationParagraphRanges(
      selectionHighlights.filter((annotation) => annotation.chapterId === chapterId),
      section.variant.paragraphs,
      paragraphIndexMap,
    )
    const quoteRanges = quoteHighlightRangesByChapter[chapterId] || []

    return [...ranges, ...quoteRanges].filter((range) => range.paragraphId === paragraphId)
  }, [loadedParagraphIndexMaps, loadedSections, quoteHighlightRangesByChapter, selectionHighlights])

  const manifestItems = useMemo(() => {
    const resolveStatus = (chapterId: string): VirtualStatus => {
      if (chapterLoader.sectionsByChapterId[chapterId]) {
        return 'ready'
      }
      if (chapterLoader.loadingIds[chapterId]) {
        return 'loading'
      }
      if (chapterLoader.failedIds[chapterId]) {
        return 'error'
      }
      return 'stub'
    }

    return manifest.map((chapter) => ({
      chapterId: chapter.chapterId,
      title: chapter.title,
      position: chapter.position,
      estimatedHeight: estimateChapterHeight({
        estimatedChars: chapter.estimatedChars,
        paragraphCount: chapter.paragraphCount,
        fontSize,
        lineHeight,
        lineWidth,
        hasCommentsAfterChapter: showCommentsAfterChapter,
        hasImages: chapter.hasImages,
      }),
      section: chapterLoader.sectionsByChapterId[chapter.chapterId],
      status: resolveStatus(chapter.chapterId),
    }))
  }, [
    chapterLoader.failedIds,
    chapterLoader.loadingIds,
    chapterLoader.sectionsByChapterId,
    fontSize,
    lineHeight,
    lineWidth,
    manifest,
    showCommentsAfterChapter,
  ])

  const virtualFeed = useVirtualBookFeed({
    chapters: manifestItems,
    scrollContainerRef: scrollRef,
    overscanScreens: 2.5,
  })
  const onQuoteFocusHandledRef = useRef(onQuoteFocusHandled)
  const ensureChapterLoadedRef = useRef(chapterLoader.ensureChapterLoaded)
  const scrollToChapterRef = useRef(virtualFeed.scrollToChapter)
  const handleVirtualFeedScrollRef = useRef(virtualFeed.handleScroll)

  useEffect(() => {
    onQuoteFocusHandledRef.current = onQuoteFocusHandled
  }, [onQuoteFocusHandled])

  useEffect(() => {
    ensureChapterLoadedRef.current = chapterLoader.ensureChapterLoaded
    scrollToChapterRef.current = virtualFeed.scrollToChapter
    handleVirtualFeedScrollRef.current = virtualFeed.handleScroll
  }, [
    chapterLoader.ensureChapterLoaded,
    virtualFeed.handleScroll,
    virtualFeed.scrollToChapter,
  ])

  const restoreOffset = useMemo(() => {
    if (restoreRequest) {
      return virtualFeed.getRestoreOffset(restoreRequest.chapterId, restoreRequest.scrollPercent)
    }

    if (activeChapterId) {
      return virtualFeed.getRestoreOffset(activeChapterId, 0)
    }

    return manifestItems[0] ? 0 : null
  }, [activeChapterId, manifestItems, restoreRequest, virtualFeed])

  useInitialScrollLock({
    scrollRef,
    ready: manifestItems.length > 0 && restoreOffset !== null,
    targetOffset: restoreOffset,
    onDone: () => {
      setInitialScrollReady(true)

      if (!initialRevealSetRef.current) {
        initialRevealSetRef.current = true
        setInitialRevealChapterId(
          restoreRequest?.chapterId || activeChapterId || manifestItems[0]?.chapterId || null,
        )
      }
    },
  })

  useEffect(() => {
    if (!restoreRequest || !scrollRef.current || !initialScrollReady) {
      return
    }

    if (restoreAppliedTokenRef.current === restoreRequest.token) {
      return
    }

    const offset = virtualFeed.getRestoreOffset(restoreRequest.chapterId, restoreRequest.scrollPercent)
    if (offset === null) {
      return
    }

    scrollRef.current.scrollTop = offset
    restoreAppliedTokenRef.current = restoreRequest.token
    virtualFeed.handleScroll()
    onActiveChapterChange(
      restoreRequest.chapterId,
      virtualFeed.getChapterProgress(restoreRequest.chapterId),
      false,
    )
  }, [initialScrollReady, onActiveChapterChange, restoreRequest, virtualFeed])

  useEffect(() => {
    if (!scrollToChapterId) {
      return
    }

    let cancelled = false

    const run = async (): Promise<void> => {
      await chapterLoader.ensureChapterLoaded(scrollToChapterId)
      if (cancelled) {
        return
      }

      virtualFeed.scrollToChapter(scrollToChapterId, 'auto')
      onActiveChapterChange(scrollToChapterId, 0, false)
      onScrollToChapterHandled?.()
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [chapterLoader, onActiveChapterChange, onScrollToChapterHandled, scrollToChapterId, virtualFeed])

  useEffect(() => {
    const quoteFocusKey = focusParagraphId
      ? [
          activeChapterId || '',
          focusParagraphId,
          focusParagraphEndId || '',
          focusStartOffset ?? '',
          focusEndOffset ?? '',
        ].join(':')
      : null

    for (const node of quoteHighlightNodesRef.current) {
      node.classList.remove('bookstream-quote-frame')
    }
    quoteHighlightNodesRef.current = []
    for (const node of quoteFocusPulseNodesRef.current) {
      node.classList.remove('bookstream-quote-focus-pulse')
    }
    quoteFocusPulseNodesRef.current = []

    if (quoteFocusTimeoutRef.current) {
      window.clearTimeout(quoteFocusTimeoutRef.current)
      quoteFocusTimeoutRef.current = null
    }

    if (!initialScrollReady || !focusParagraphId || !scrollRef.current || !activeChapterId || !quoteFocusKey) {
      return
    }

    if (lastHandledQuoteFocusKeyRef.current === quoteFocusKey) {
      return
    }

    let cancelled = false

    const run = async (): Promise<void> => {
      await ensureChapterLoadedRef.current(activeChapterId)
      if (cancelled || !scrollRef.current) {
        return
      }

      scrollToChapterRef.current(activeChapterId, 'auto')

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve())
      })

      if (cancelled || !scrollRef.current) {
        return
      }

      const target = await waitForQuoteTarget(scrollRef.current, focusParagraphId)
      if (!target || cancelled || !scrollRef.current) {
        return
      }

      const pulseNodes = [
        target,
        target.closest<HTMLElement>('.feed-paragraph'),
      ].filter((node): node is HTMLElement => Boolean(node))
      for (const node of pulseNodes) {
        node.classList.add('bookstream-quote-focus-pulse')
      }
      quoteFocusPulseNodesRef.current = pulseNodes

      if (!hasPreciseFocusQuote) {
        const frames = collectParagraphRangeElements(
          scrollRef.current,
          focusParagraphId,
          focusParagraphEndId,
        )
        for (const node of frames) {
          node.classList.add('bookstream-quote-frame')
        }
        quoteHighlightNodesRef.current = frames
      }

      scrollQuoteTargetIntoView(scrollRef.current, target)
      handleVirtualFeedScrollRef.current()

      quoteFocusTimeoutRef.current = window.setTimeout(() => {
        for (const node of quoteFocusPulseNodesRef.current) {
          node.classList.remove('bookstream-quote-focus-pulse')
        }

        quoteFocusPulseNodesRef.current = []
        quoteFocusTimeoutRef.current = null

        if (!cancelled) {
          lastHandledQuoteFocusKeyRef.current = quoteFocusKey
          onQuoteFocusHandledRef.current?.()
        }
      }, 1100)
    }

    void run()

    return () => {
      cancelled = true
      if (quoteFocusTimeoutRef.current) {
        window.clearTimeout(quoteFocusTimeoutRef.current)
        quoteFocusTimeoutRef.current = null
      }
      for (const node of quoteHighlightNodesRef.current) {
        node.classList.remove('bookstream-quote-frame')
      }
      quoteHighlightNodesRef.current = []
      for (const node of quoteFocusPulseNodesRef.current) {
        node.classList.remove('bookstream-quote-focus-pulse')
      }
      quoteFocusPulseNodesRef.current = []
    }
  }, [
    activeChapterId,
    focusEndOffset,
    focusParagraphEndId,
    focusParagraphId,
    focusStartOffset,
    hasPreciseFocusQuote,
    initialScrollReady,
  ])

  useEffect(() => {
    if (!activeChapterId && virtualFeed.items.length > 0) {
      onActiveChapterChange(virtualFeed.items[0].chapterId, 0, false)
    }
  }, [activeChapterId, onActiveChapterChange, virtualFeed.items])

  const handleVirtualScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    onNavigate?.()
    virtualFeed.handleScroll()

    if (tickingRef.current) {
      return
    }

    tickingRef.current = true

    window.requestAnimationFrame(() => {
      const activeId = resolveActiveChapterFromVirtualLayout({
        items: virtualFeed.items,
        scrollTop: container.scrollTop,
        viewportHeight: container.clientHeight,
      })

      if (activeId) {
        onActiveChapterChange(activeId, virtualFeed.getChapterProgress(activeId), true)
      }

      tickingRef.current = false
    })
  }, [onActiveChapterChange, onNavigate, virtualFeed])

  const clearPointerGesture = useCallback((): void => {
    pointerGestureRef.current = null
  }, [])

  const isInteractiveTarget = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    return Boolean(target.closest(
      'button, a, input, textarea, select, label, [role="dialog"], [data-reader-ignore-chrome], .selection-toolbar',
    ))
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!onSurfaceTap || event.button !== 0) {
      clearPointerGesture()
      return
    }

    pointerGestureRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      clientX: event.clientX,
      clientY: event.clientY,
    }
  }, [clearPointerGesture, onSurfaceTap])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current
    clearPointerGesture()

    if (!onSurfaceTap || !gesture || gesture.pointerId !== event.pointerId) {
      return
    }

    if (isInteractiveTarget(event.target)) {
      return
    }

    const dx = event.clientX - gesture.clientX
    const dy = event.clientY - gesture.clientY
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      return
    }

    window.setTimeout(() => {
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) {
        return
      }

      onSurfaceTap()
    }, 0)
  }, [clearPointerGesture, isInteractiveTarget, onSurfaceTap])

  const handlePointerCancel = useCallback(() => {
    clearPointerGesture()
  }, [clearPointerGesture])

  const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.buttons & 1) === 0) {
      clearPointerGesture()
    }
  }, [clearPointerGesture])

  const contentMaxWidth = lineWidth === 'narrow'
    ? '36rem'
    : lineWidth === 'medium'
      ? '48rem'
      : '64rem'

  const selectorVariantId = useMemo(() => {
    return virtualFeed.visibleChapters.find((chapter) => chapter.section)?.section?.variant.id
      || loadedSections[0]?.variant.id
      || ''
  }, [loadedSections, virtualFeed.visibleChapters])

  return (
    <div
      className="feed-reader-shell"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
    >
      <div
        ref={(node) => {
          scrollRef.current = node
          setContentNode?.(node)
        }}
        className="reader-scrollbar feed-reader"
        onScroll={handleVirtualScroll}
        style={{ overflowY: 'auto', height: '100%' }}
      >
        <TextSelector
          containerRef={scrollRef}
          variantId={selectorVariantId}
          authorSlug={authorSlug}
          bookSlug={bookSlug}
          onSelectionAnnotation={handleSelectionAnnotation}
        />

        <div className="feed-reader__content">
          <div className="feed-reader__virtual-canvas" style={{ minHeight: virtualFeed.totalHeight }}>
            <div style={{ height: virtualFeed.topSpacerHeight }} />

            {virtualFeed.visibleChapters.map((virtualChapter) => {
              if (!virtualChapter.section) {
                return (
                  <ChapterSkeleton
                    key={virtualChapter.chapterId}
                    title={virtualChapter.title}
                    height={virtualChapter.estimatedHeight}
                    contentMaxWidth={contentMaxWidth}
                  />
                )
              }

              return (
                <MeasuredChapter
                  key={virtualChapter.chapterId}
                  chapterId={virtualChapter.chapterId}
                  onMeasure={virtualFeed.registerMeasuredHeight}
                >
                  <ReaderChapterSection
                    section={virtualChapter.section}
                    isActiveSection={virtualChapter.chapterId === activeChapterId}
                    isInitialReveal={virtualChapter.chapterId === initialRevealChapterId}
                    contentMaxWidth={contentMaxWidth}
                    fontSize={fontSize}
                    lineHeight={lineHeight}
                    lineWidth={lineWidth}
                    bookmarkedKeys={bookmarkedKeys}
                    onToggleBookmark={onToggleBookmark}
                  authorSlug={authorSlug}
                  bookSlug={bookSlug}
                  showCommentsAfterChapter={showCommentsAfterChapter}
                  showReactionBar={showReactionBar}
                  showMobileReactionBar={showMobileReactionBar}
                  highlightParagraphId={highlightParagraphId}
                  hasPreciseQuoteHighlight={hasPreciseQuoteHighlight}
                  bookId={bookId}
                  composerOpenChapterId={composerOpenChapterId}
                  composerOpenRequest={composerOpenRequest}
                  onSendComment={onSendComment}
                  getTextRangesForParagraph={getTextRangesForParagraph}
                />
                </MeasuredChapter>
              )
            })}

            <div style={{ height: virtualFeed.bottomSpacerHeight }} />
          </div>
        </div>
      </div>
    </div>
  )
}
