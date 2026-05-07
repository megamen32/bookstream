'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type React from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useReaderStore } from '@/lib/store'
import './FeedReader.css'
import TextSelector from './TextSelector'
import type { SelectionAnnotationRange } from './TextSelector'
import ReactionBar from './ReactionBar'
import ChapterAfterword from './ChapterAfterword'
import type { FeedSectionData } from './feed-types'
import { findQuoteParagraphElement, scrollQuoteTargetIntoView } from '@/lib/quote-navigation'
import { collectParagraphRangeElements } from '@/lib/paragraph-selection'
import {
  buildAnnotationParagraphRanges,
  splitTextByAnnotationRanges,
  type AnnotationParagraphRange,
  type UnifiedAnnotationItem,
} from '@/lib/annotations'

interface FeedReaderProps {
  sections: FeedSectionData[]
  activeChapterId: string | null
  hasMorePrev: boolean
  hasMoreNext: boolean
  loadingPrev: boolean
  loadingNext: boolean
  onLoadPrev: () => void
  onLoadNext: () => void
  onActiveChapterChange: (chapterId: string, scrollPercent: number, fromScroll: boolean) => void
  setContentNode?: (node: HTMLDivElement | null) => void
  bookmarkedKeys: Record<string, string | undefined>
  onToggleBookmark?: (chapterId: string, stableKey: string) => void
  authorSlug: string
  bookSlug: string
  showCommentsAfterChapter?: boolean
  highlightParagraphId?: string | null
  highlightParagraphEndId?: string | null
  highlightStartOffset?: number | null
  highlightEndOffset?: number | null
  restoreRequest?: { chapterId: string; scrollPercent: number; token: number } | null
  scrollToChapterId?: string | null
  onScrollToChapterHandled?: () => void
  onOpenChapterComments?: (chapterId: string) => void
  onSurfaceTap?: () => void
}

interface StoredSelectionAnnotationRange extends SelectionAnnotationRange {
  chapterId?: string
}

interface ScrollSnapshot {
  firstChapterId: string
  scrollTop: number
  scrollHeight: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export default function FeedReader({
  sections,
  activeChapterId,
  hasMorePrev,
  hasMoreNext,
  loadingPrev,
  loadingNext,
  onLoadPrev,
  onLoadNext,
  onActiveChapterChange,
  setContentNode,
  bookmarkedKeys,
  onToggleBookmark,
  authorSlug,
  bookSlug,
  showCommentsAfterChapter = true,
  highlightParagraphId,
  highlightParagraphEndId,
  highlightStartOffset,
  highlightEndOffset,
  restoreRequest,
  scrollToChapterId,
  onScrollToChapterHandled,
  onOpenChapterComments,
  onSurfaceTap,
}: FeedReaderProps) {
  const { fontSize, lineHeight, lineWidth, bookId, readerId, showMobileReactionBar } = useReaderStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const quoteHighlightNodesRef = useRef<HTMLElement[]>([])
  const restoreAppliedTokenRef = useRef<number | null>(null)
  const prependSnapshotRef = useRef<ScrollSnapshot | null>(null)
  const tickingRef = useRef(false)

  const [selectionHighlights, setSelectionHighlights] = useState<StoredSelectionAnnotationRange[]>([])
  const paragraphIndexMaps = useMemo(() => (
    Object.fromEntries(
      sections.map((section) => [
        section.chapter.id,
        new Map(section.variant.paragraphs.map((paragraph, index) => [paragraph.id, index])),
      ]),
    ) as Record<string, Map<string, number>>
  ), [sections])
  const hasPreciseQuoteHighlight = Number.isFinite(highlightStartOffset) && Number.isFinite(highlightEndOffset)
  const quoteHighlightRangesByChapter = useMemo(() => {
    if (!highlightParagraphId || !hasPreciseQuoteHighlight) {
      return {}
    }

    const section = sections.find((entry) => entry.variant.paragraphs.some((paragraph) => paragraph.id === highlightParagraphId))
    if (!section) {
      return {}
    }

    const paragraphIndexMap = paragraphIndexMaps[section.chapter.id]
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
  }, [hasPreciseQuoteHighlight, highlightEndOffset, highlightParagraphEndId, highlightParagraphId, highlightStartOffset, paragraphIndexMaps, sections])

  useEffect(() => {
    if (!readerId || !bookId) return

    const controller = new AbortController()

    const loadSelectionHighlights = async (): Promise<void> => {
      try {
        const params = new URLSearchParams({ readerId, bookId })
        const response = await fetch(`/api/annotations?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) return

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
        entry.kind === candidate.kind &&
        entry.chapterId === candidate.chapterId &&
        entry.paragraphId === candidate.paragraphId &&
        entry.endParagraphId === candidate.endParagraphId &&
        entry.startOffset === candidate.startOffset &&
        entry.endOffset === candidate.endOffset &&
        entry.emoji === candidate.emoji &&
        entry.body === candidate.body
      )

      if (!active) {
        return current.filter((entry) => !isSame(entry))
      }

      return current.some(isSame) ? current : [...current, candidate]
    })
  }, [])

  const getTextRangesForParagraph = useCallback(
    (chapterId: string, paragraphId: string): AnnotationParagraphRange[] => {
      const section = sections.find((entry) => entry.chapter.id === chapterId)
      const paragraphIndexMap = paragraphIndexMaps[chapterId]

      if (!section || !paragraphIndexMap) return []

      const ranges = buildAnnotationParagraphRanges(
        selectionHighlights.filter((annotation) => annotation.chapterId === chapterId),
        section.variant.paragraphs,
        paragraphIndexMap,
      )

      const quoteRanges = quoteHighlightRangesByChapter[chapterId] || []

      return [...ranges, ...quoteRanges].filter((range) => range.paragraphId === paragraphId)
    },
    [paragraphIndexMaps, quoteHighlightRangesByChapter, sections, selectionHighlights],
  )

  const resolveSectionProgress = useCallback((chapterId: string): number => {
    const container = scrollRef.current
    const currentNode = sectionRefs.current[chapterId]

    if (!container || !currentNode) return 0

    const sectionIndex = sections.findIndex((section) => section.chapter.id === chapterId)

    const nextNode = sectionIndex >= 0
      ? sectionRefs.current[sections[sectionIndex + 1]?.chapter.id || '']
      : null

    const sectionTop = currentNode.offsetTop

    const sectionBottom = nextNode
      ? nextNode.offsetTop
      : Math.max(currentNode.offsetTop + currentNode.offsetHeight, container.scrollHeight)

    const sectionHeight = Math.max(1, sectionBottom - sectionTop - container.clientHeight * 0.2)

    return clamp((container.scrollTop - sectionTop) / sectionHeight, 0, 1)
  }, [sections])

  const updateActiveChapter = useCallback((fromScroll: boolean) => {
    const container = scrollRef.current

    if (!container || sections.length === 0) return

    const threshold = container.scrollTop + container.clientHeight * 0.22
    let nextActiveId = sections[0].chapter.id

    for (const section of sections) {
      const node = sectionRefs.current[section.chapter.id]
      if (!node) continue

      if (node.offsetTop <= threshold) {
        nextActiveId = section.chapter.id
      } else {
        break
      }
    }

    const nextProgress = resolveSectionProgress(nextActiveId)

    onActiveChapterChange(nextActiveId, nextProgress, fromScroll)
  }, [onActiveChapterChange, resolveSectionProgress, sections])

  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    const topDistance = container.scrollTop
    const bottomDistance = container.scrollHeight - container.scrollTop - container.clientHeight

    if (hasMorePrev && !loadingPrev && topDistance < 240 && sections.length > 0) {
      prependSnapshotRef.current = {
        firstChapterId: sections[0].chapter.id,
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      }

      onLoadPrev()
    }

    if (hasMoreNext && !loadingNext && bottomDistance < 420) {
      onLoadNext()
    }

    if (tickingRef.current) return

    tickingRef.current = true

    window.requestAnimationFrame(() => {
      updateActiveChapter(true)
      tickingRef.current = false
    })
  }, [
    hasMoreNext,
    hasMorePrev,
    loadingNext,
    loadingPrev,
    onLoadNext,
    onLoadPrev,
    sections,
    updateActiveChapter,
  ])

  useEffect(() => {
    const container = scrollRef.current
    const topSentinel = topSentinelRef.current
    const bottomSentinel = bottomSentinelRef.current

    if (!container || !topSentinel || !bottomSentinel) return

    const topObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMorePrev && !loadingPrev && sections.length > 0) {
          prependSnapshotRef.current = {
            firstChapterId: sections[0].chapter.id,
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
          }

          onLoadPrev()
        }
      },
      { root: container, threshold: 0.1 },
    )

    const bottomObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreNext && !loadingNext) {
          onLoadNext()
        }
      },
      { root: container, threshold: 0.1 },
    )

    topObserver.observe(topSentinel)
    bottomObserver.observe(bottomSentinel)

    return () => {
      topObserver.disconnect()
      bottomObserver.disconnect()
    }
  }, [hasMoreNext, hasMorePrev, loadingNext, loadingPrev, onLoadNext, onLoadPrev, sections])

  useEffect(() => {
    const snapshot = prependSnapshotRef.current
    const container = scrollRef.current

    if (!snapshot || !container || loadingPrev) return

    const currentFirstId = sections[0]?.chapter.id

    if (!currentFirstId || currentFirstId === snapshot.firstChapterId) {
      prependSnapshotRef.current = null
      return
    }

    const delta = container.scrollHeight - snapshot.scrollHeight
    container.scrollTop = snapshot.scrollTop + delta
    prependSnapshotRef.current = null
  }, [loadingPrev, sections])

  useEffect(() => {
    for (const node of quoteHighlightNodesRef.current) {
      node.classList.remove('bookstream-quote-frame')
    }

    quoteHighlightNodesRef.current = []

    if (!highlightParagraphId || !scrollRef.current) return

    const frameId = window.requestAnimationFrame(() => {
      if (!scrollRef.current) return

      const target = findQuoteParagraphElement(scrollRef.current, highlightParagraphId)
      if (!target) return

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
      updateActiveChapter(false)
    })

    return () => {
      window.cancelAnimationFrame(frameId)

      for (const node of quoteHighlightNodesRef.current) {
        node.classList.remove('bookstream-quote-frame')
      }

      quoteHighlightNodesRef.current = []
    }
  }, [hasPreciseQuoteHighlight, highlightParagraphEndId, highlightParagraphId, sections, updateActiveChapter])

  useEffect(() => {
    if (!restoreRequest || highlightParagraphId || !scrollRef.current) return
    if (restoreAppliedTokenRef.current === restoreRequest.token) return

    const targetNode = sectionRefs.current[restoreRequest.chapterId]
    if (!targetNode) return

    const frameId = window.requestAnimationFrame(() => {
      const container = scrollRef.current
      const currentTarget = sectionRefs.current[restoreRequest.chapterId]

      if (!container || !currentTarget) return

      const sectionIndex = sections.findIndex((section) => section.chapter.id === restoreRequest.chapterId)

      const nextNode = sectionIndex >= 0
        ? sectionRefs.current[sections[sectionIndex + 1]?.chapter.id || '']
        : null

      const sectionBottom = nextNode
        ? nextNode.offsetTop
        : Math.max(currentTarget.offsetTop + currentTarget.offsetHeight, container.scrollHeight)

      const travel = Math.max(
        0,
        sectionBottom - currentTarget.offsetTop - container.clientHeight * 0.2,
      )

      container.scrollTop = currentTarget.offsetTop + travel * restoreRequest.scrollPercent
      restoreAppliedTokenRef.current = restoreRequest.token

      updateActiveChapter(false)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [highlightParagraphId, restoreRequest, sections, updateActiveChapter])

  useEffect(() => {
    if (!scrollToChapterId || !scrollRef.current) return

    const targetNode = sectionRefs.current[scrollToChapterId]
    if (!targetNode) return

    const frameId = window.requestAnimationFrame(() => {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
      updateActiveChapter(false)
      onScrollToChapterHandled?.()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [onScrollToChapterHandled, scrollToChapterId, sections, updateActiveChapter])

  useEffect(() => {
    updateActiveChapter(false)
  }, [activeChapterId, sections, updateActiveChapter])

  const handleBookmarkClick = useCallback((
    event: React.MouseEvent,
    chapterId: string,
    stableKey: string,
  ) => {
    event.stopPropagation()
    onToggleBookmark?.(chapterId, stableKey)
  }, [onToggleBookmark])

  const handleSurfaceClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onSurfaceTap) {
      return
    }

    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    if (target.closest(
      'button, a, input, textarea, select, label, [role="dialog"], [data-reader-ignore-chrome], .selection-toolbar',
    )) {
      return
    }

    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) {
      return
    }

    onSurfaceTap()
  }, [onSurfaceTap])

  const contentMaxWidth = lineWidth === 'narrow'
    ? '36rem'
    : lineWidth === 'medium'
      ? '48rem'
      : '64rem'

  return (
    <div className="feed-reader-shell" onClick={handleSurfaceClick}>
      <div
        ref={(node) => {
          scrollRef.current = node
          setContentNode?.(node)
        }}
        className="reader-scrollbar feed-reader"
        onScroll={handleScroll}
        style={{ overflowY: 'auto', height: '100%' }}
      >
        <TextSelector
          containerRef={scrollRef}
          variantId={sections[0]?.variant.id || ''}
          onSelectionAnnotation={handleSelectionAnnotation}
        />

        <div ref={topSentinelRef} style={{ height: '1px' }} />

        <div ref={contentRef} className="feed-reader__content">
          {sections.map((section) => {
            const isActiveSection = section.chapter.id === activeChapterId
            const bookmarkedKey = bookmarkedKeys[section.chapter.id] || null
            return (
              <section
                key={`${section.chapter.id}-${section.variant.variantType}`}
                ref={(node) => {
                  sectionRefs.current[section.chapter.id] = node
                }}
                data-chapter-id={section.chapter.id}
                data-variant-id={section.variant.id}
                data-variant-type={section.variant.variantType}
                className={`feed-section${isActiveSection ? ' is-active' : ''}`}
                style={{
                  maxWidth: contentMaxWidth,
                  margin: '0 auto',
                }}
              >
                <div className="feed-chapter-header">
                  <div className="feed-chapter-header__eyebrow">
                    Глава {section.chapter.position + 1}
                  </div>

                  <h1 className="feed-chapter-header__title">
                    {section.chapter.title}
                  </h1>

                  <div className="feed-chapter-header__rule" aria-hidden="true">
                    <span className="feed-chapter-header__rule-line" />
                    <span className="feed-chapter-header__rule-dot" />
                    <span className="feed-chapter-header__rule-line" />
                  </div>
                </div>

                <div
                  className="reader-content feed-reader-content"
                  data-line-width={lineWidth}
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: `${lineHeight}`,
                    margin: '0 auto',
                  }}
                >
                  {section.variant.paragraphs.map((paragraph) => {
                    const isQuoteTarget = highlightParagraphId === paragraph.id && !hasPreciseQuoteHighlight
                    const ranges = getTextRangesForParagraph(section.chapter.id, paragraph.id)
                    const hasSelectionHighlight = ranges.length > 0
                    const textSegments = splitTextByAnnotationRanges(paragraph.text, ranges)
                    const canRenderRichParagraph = !hasSelectionHighlight && Boolean(paragraph.html)

                    return (
                      <div
                        key={paragraph.stableKey || paragraph.id}
                        className={`feed-paragraph group${hasSelectionHighlight ? ' has-selection-highlight' : ''}${isQuoteTarget ? ' is-quote-target' : ''}`}
                      >
                        {isQuoteTarget ? (
                          <span className="feed-paragraph__quote-badge">
                            Цитата
                          </span>
                        ) : null}

                        <article
                          data-paragraph-id={paragraph.id}
                          data-stable-key={paragraph.stableKey}
                          className="feed-paragraph__article"
                        >
                          <button
                            onClick={(event) => handleBookmarkClick(
                              event,
                              section.chapter.id,
                              paragraph.stableKey,
                            )}
                            title={bookmarkedKey === paragraph.stableKey ? 'Убрать закладку' : 'Поставить закладку'}
                            className={`feed-paragraph__bookmark${bookmarkedKey === paragraph.stableKey ? ' is-active' : ''}`}
                          >
                            {bookmarkedKey === paragraph.stableKey
                              ? <BookmarkCheck size={16} />
                              : <Bookmark size={16} />}
                          </button>

                          {canRenderRichParagraph ? (
                            <p
                              style={{
                                margin: 0,
                                textAlign: paragraph.textAlign ?? undefined,
                                paddingInlineStart: paragraph.indentPx
                                  ? `${Math.min(paragraph.indentPx, 160)}px`
                                  : undefined,
                              }}
                              dangerouslySetInnerHTML={{ __html: paragraph.html || '' }}
                            />
                          ) : (
                            <p
                              style={{
                                margin: 0,
                                textAlign: paragraph.textAlign ?? undefined,
                                paddingInlineStart: paragraph.indentPx
                                  ? `${Math.min(paragraph.indentPx, 160)}px`
                                  : undefined,
                              }}
                            >
                              {textSegments.map((segment, index) => (
                                segment.highlighted ? (
                                  <span
                                    key={`${paragraph.id}-hl-${index}`}
                                    className="bookstream-inline-annotation"
                                  >
                                    <span className="bookstream-word-highlight">
                                      {segment.text}
                                    </span>

                                    {segment.badges.map((badge, badgeIndex) => (
                                      <span
                                        key={`${paragraph.id}-badge-${index}-${badgeIndex}-${badge.kind}-${badge.emoji || badge.badgeLabel}`}
                                        className="bookstream-inline-annotation-badge"
                                        data-kind={badge.kind}
                                        title={
                                          badge.kind === 'reaction'
                                            ? 'Вы поставили реакцию'
                                            : badge.kind === 'quote'
                                              ? 'Вы вынесли цитату'
                                              : 'Вы оставили комментарий'
                                        }
                                      >
                                        {badge.kind === 'reaction'
                                          ? badge.emoji || '•'
                                          : badge.kind === 'quote'
                                            ? '»'
                                            : '✎'}
                                      </span>
                                    ))}
                                  </span>
                                ) : (
                                  <span key={`${paragraph.id}-txt-${index}`}>
                                    {segment.text}
                                  </span>
                                )
                              ))}
                            </p>
                          )}
                        </article>

                        <ReactionBar
                          paragraphId={paragraph.id}
                          variantId={section.variant.id}
                          chapterId={section.chapter.id}
                          variantType={section.variant.variantType}
                          showOnMobile={showMobileReactionBar}
                        />
                      </div>
                    )
                  })}
                </div>

                <ChapterAfterword
                  chapterId={section.chapter.id}
                  chapterTitle={section.chapter.title}
                  authorSlug={authorSlug}
                  bookSlug={bookSlug}
                  preview={section.preview}
                  showCommentsAfterChapter={showCommentsAfterChapter}
                  onOpenComments={() => onOpenChapterComments?.(section.chapter.id)}
                />

                <div className="feed-chapter-footer">
                  <span className="feed-chapter-footer__label">
                    {section.nextChapterId ? 'Следующая глава ниже' : 'Конец книги'}
                  </span>
                </div>
              </section>
            )
          })}

          {(loadingNext || hasMoreNext) ? (
            <div className="feed-reader__continuation">
              {loadingNext ? 'Подгружаем следующую главу...' : 'Прокрутите ниже для продолжения'}
            </div>
          ) : null}
        </div>

        <div ref={bottomSentinelRef} style={{ height: '1px' }} />
        <div style={{ height: '2rem' }} />
      </div>
    </div>
  )
}
