'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type React from 'react'
import { useReaderStore } from '@/lib/store'
import type { ReplyQuote } from '@/lib/store'
import './FeedReader.css'
import TextSelector from './TextSelector'
import type { SelectionAnnotationRange } from './TextSelector'
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
  showCommentsAfterChapter?: boolean
  showReactionBar?: boolean
  highlightParagraphId?: string | null
  highlightParagraphEndId?: string | null
  highlightStartOffset?: number | null
  highlightEndOffset?: number | null
  restoreRequest?: { chapterId: string; scrollPercent: number; token: number } | null
  scrollToChapterId?: string | null
  onScrollToChapterHandled?: () => void
  onOpenChapterComments?: (chapterId: string, replyTo?: ReplyQuote | null) => void
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

export default function FeedReader({
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
  showCommentsAfterChapter = true,
  showReactionBar = true,
  highlightParagraphId,
  highlightParagraphEndId,
  highlightStartOffset,
  highlightEndOffset,
  restoreRequest,
  scrollToChapterId,
  onScrollToChapterHandled,
  onOpenChapterComments,
  onSurfaceTap,
  onNavigate,
}: FeedReaderProps) {
  const { fontSize, lineHeight, lineWidth, bookId, readerId, showMobileReactionBar } = useReaderStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const quoteHighlightNodesRef = useRef<HTMLElement[]>([])
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
    for (const node of quoteHighlightNodesRef.current) {
      node.classList.remove('bookstream-quote-frame')
    }
    quoteHighlightNodesRef.current = []

    if (!highlightParagraphId || !scrollRef.current || !activeChapterId) {
      return
    }

    let cancelled = false

    const run = async (): Promise<void> => {
      await chapterLoader.ensureChapterLoaded(activeChapterId)
      if (cancelled || !scrollRef.current) {
        return
      }

      virtualFeed.scrollToChapter(activeChapterId, 'auto')

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (cancelled || !scrollRef.current) {
            return
          }

          const target = findQuoteParagraphElement(scrollRef.current, highlightParagraphId)
          if (!target) {
            return
          }

          if (!hasPreciseQuoteHighlight) {
            const frames = collectParagraphRangeElements(
              scrollRef.current,
              highlightParagraphId,
              highlightParagraphEndId,
            )
            for (const node of frames) {
              node.classList.add('bookstream-quote-frame')
            }
            quoteHighlightNodesRef.current = frames
          }

          scrollQuoteTargetIntoView(scrollRef.current, target)
          virtualFeed.handleScroll()
        })
      })
    }

    void run()

    return () => {
      cancelled = true
      for (const node of quoteHighlightNodesRef.current) {
        node.classList.remove('bookstream-quote-frame')
      }
      quoteHighlightNodesRef.current = []
    }
  }, [
    activeChapterId,
    chapterLoader,
    hasPreciseQuoteHighlight,
    highlightParagraphEndId,
    highlightParagraphId,
    virtualFeed,
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
                    onOpenChapterComments={onOpenChapterComments}
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
