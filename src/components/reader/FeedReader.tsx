'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useReaderStore } from '@/lib/store'
import TextSelector from './TextSelector'
import type { SelectionAnnotationRange } from './TextSelector'
import CommentsSection from './CommentsSection'
import ReactionBar from './ReactionBar'
import type { CommentSubmitHandler } from './comment-types'
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
  commentsSectionRef?: React.RefObject<HTMLDivElement | null>
  onSendComment: CommentSubmitHandler
  setContentNode?: (node: HTMLDivElement | null) => void
  bookmarkedKeys: Record<string, string | undefined>
  onToggleBookmark?: (chapterId: string, stableKey: string) => void
  authorSlug: string
  bookSlug: string
  highlightParagraphId?: string | null
  highlightParagraphEndId?: string | null
  restoreRequest?: { chapterId: string; scrollPercent: number; token: number } | null
  scrollToChapterId?: string | null
  onScrollToChapterHandled?: () => void
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
  commentsSectionRef,
  onSendComment,
  setContentNode,
  bookmarkedKeys,
  onToggleBookmark,
  authorSlug,
  bookSlug,
  highlightParagraphId,
  highlightParagraphEndId,
  restoreRequest,
  scrollToChapterId,
  onScrollToChapterHandled,
}: FeedReaderProps) {
  const { fontSize, lineHeight, lineWidth, theme, bookId, readerId, showMobileReactionBar } = useReaderStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const quoteFocusAppliedRef = useRef(false)
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

  useEffect(() => {
    quoteFocusAppliedRef.current = false
  }, [highlightParagraphId, highlightParagraphEndId])

  useEffect(() => {
    if (!readerId || !bookId) return

    const controller = new AbortController()

    const loadSelectionHighlights = async (): Promise<void> => {
      try {
        const params = new URLSearchParams({
          readerId,
          bookId,
        })
        const response = await fetch(`/api/annotations?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) return

        const data = await response.json() as {
          annotations?: UnifiedAnnotationItem[]
        }
        const loaded = (Array.isArray(data.annotations) ? data.annotations : []).map<StoredSelectionAnnotationRange>((annotation) => ({
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
      if (!active) {
        return current.filter(
          (entry) =>
            !(
              entry.kind === candidate.kind &&
              entry.chapterId === candidate.chapterId &&
              entry.paragraphId === candidate.paragraphId &&
              entry.endParagraphId === candidate.endParagraphId &&
              entry.startOffset === candidate.startOffset &&
              entry.endOffset === candidate.endOffset &&
              entry.emoji === candidate.emoji &&
              entry.body === candidate.body
            ),
        )
      }

      return current.some(
        (entry) =>
          entry.kind === candidate.kind &&
          entry.chapterId === candidate.chapterId &&
          entry.paragraphId === candidate.paragraphId &&
          entry.endParagraphId === candidate.endParagraphId &&
          entry.startOffset === candidate.startOffset &&
          entry.endOffset === candidate.endOffset &&
          entry.emoji === candidate.emoji &&
          entry.body === candidate.body,
      )
        ? current
        : [...current, candidate]
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
      return ranges.filter((range) => range.paragraphId === paragraphId)
    },
    [paragraphIndexMaps, sections, selectionHighlights],
  )

  const resolveSectionProgress = useCallback((chapterId: string): number => {
    const container = scrollRef.current
    if (!container) return 0

    const currentNode = sectionRefs.current[chapterId]
    if (!currentNode) return 0

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

    onActiveChapterChange(nextActiveId, resolveSectionProgress(nextActiveId), fromScroll)
  }, [onActiveChapterChange, resolveSectionProgress, sections])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return

    const container = scrollRef.current
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
  }, [hasMoreNext, hasMorePrev, loadingNext, loadingPrev, onLoadNext, onLoadPrev, sections, updateActiveChapter])

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

      const frames = collectParagraphRangeElements(
        scrollRef.current,
        highlightParagraphId,
        highlightParagraphEndId,
      )
      for (const node of frames) {
        node.classList.add('bookstream-quote-frame')
      }
      quoteHighlightNodesRef.current = frames

      scrollQuoteTargetIntoView(scrollRef.current, target)
      quoteFocusAppliedRef.current = true
      updateActiveChapter(false)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      for (const node of quoteHighlightNodesRef.current) {
        node.classList.remove('bookstream-quote-frame')
      }
      quoteHighlightNodesRef.current = []
    }
  }, [highlightParagraphEndId, highlightParagraphId, sections, updateActiveChapter])

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
      const travel = Math.max(0, sectionBottom - currentTarget.offsetTop - container.clientHeight * 0.2)
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

  const handleBookmarkClick = useCallback((event: React.MouseEvent, chapterId: string, stableKey: string) => {
    event.stopPropagation()
    onToggleBookmark?.(chapterId, stableKey)
  }, [onToggleBookmark])

  const contentMaxWidth = lineWidth === 'narrow' ? '36rem' : lineWidth === 'medium' ? '48rem' : '64rem'

  return (
    <div
      ref={(node) => {
        scrollRef.current = node
        setContentNode?.(node)
      }}
      className="reader-scrollbar"
      onScroll={handleScroll}
      style={{ overflowY: 'auto', height: '100%', padding: '1.5rem 1rem' }}
    >
      <TextSelector containerRef={scrollRef} variantId={sections[0]?.variant.id || ''} onSelectionAnnotation={handleSelectionAnnotation} />
      <div ref={topSentinelRef} style={{ height: '1px' }} />
      <div ref={contentRef} style={{ position: 'relative' }}>
        {sections.map((section, sectionIndex) => {
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
              style={{
                maxWidth: contentMaxWidth,
                margin: sectionIndex === 0 ? '0 auto 2rem' : '0 auto 2.5rem',
              }}
            >
              <div
                style={{
                  marginBottom: '1.25rem',
                  paddingBottom: '0.75rem',
                  textAlign: 'center',
                  borderBottom: sectionIndex > 0 ? '1px solid var(--r-border)' : 'none',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.6rem',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--r-bg-secondary)',
                    padding: '0.35rem 0.8rem',
                    color: 'var(--r-text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  Глава {section.chapter.position + 1}
                </div>
                <h1
                  style={{
                    margin: 0,
                    color: 'var(--r-text)',
                    fontSize: 'clamp(1.4rem, 2.8vw, 2.2rem)',
                    lineHeight: 1.08,
                    fontWeight: 780,
                    letterSpacing: '-0.05em',
                  }}
                >
                  {section.chapter.title}
                </h1>
              </div>

              <div
                className="reader-content"
                data-line-width={lineWidth}
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: `${lineHeight}`,
                  margin: '0 auto',
                }}
              >
                {section.variant.paragraphs.map((paragraph) => {
                  const isQuoteTarget = highlightParagraphId === paragraph.id
                  const ranges = getTextRangesForParagraph(section.chapter.id, paragraph.id)
                  const hasSelectionHighlight = ranges.length > 0
                  const textSegments = splitTextByAnnotationRanges(paragraph.text, ranges)
                  const canRenderRichParagraph = !hasSelectionHighlight && Boolean(paragraph.html)

                  return (
                    <div
                      key={paragraph.stableKey || paragraph.id}
                      className="group"
                      style={{
                        position: 'relative',
                        marginBottom: '0.25rem',
                        backgroundColor: hasSelectionHighlight
                          ? 'color-mix(in srgb, var(--r-accent) 6%, transparent)'
                          : isQuoteTarget
                            ? 'rgba(245, 158, 11, 0.10)'
                            : 'transparent',
                        transition: 'box-shadow 0.25s ease, background-color 0.25s ease, transform 0.25s ease',
                      }}
                    >
                      {isQuoteTarget && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-0.6rem',
                            right: '0.75rem',
                            zIndex: 2,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            backgroundColor: 'var(--r-accent)',
                            color: 'var(--r-accent-foreground)',
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.14)',
                            pointerEvents: 'none',
                          }}
                        >
                          Цитата
                        </span>
                      )}
                      <article
                        data-paragraph-id={paragraph.id}
                        data-stable-key={paragraph.stableKey}
                        style={{ marginBottom: '0.5rem' }}
                      >
                        <button
                          onClick={(event) => handleBookmarkClick(event, section.chapter.id, paragraph.stableKey)}
                          title={bookmarkedKey === paragraph.stableKey ? 'Убрать закладку' : 'Поставить закладку'}
                          style={{
                            position: 'absolute',
                            left: '-2rem',
                            top: '0',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            opacity: bookmarkedKey === paragraph.stableKey ? 1 : 0,
                            transition: 'opacity 0.2s ease, transform 0.2s ease',
                            transform: bookmarkedKey === paragraph.stableKey ? 'scale(1.1)' : 'scale(1)',
                            color: bookmarkedKey === paragraph.stableKey ? 'var(--r-accent)' : 'var(--r-text-secondary)',
                            padding: '0.25rem',
                            lineHeight: 1,
                            pointerEvents: 'auto',
                          }}
                          className="bookmark-btn"
                        >
                          {bookmarkedKey === paragraph.stableKey ? '🔖' : '📑'}
                        </button>
                        {canRenderRichParagraph ? (
                          <p
                            style={{
                              margin: 0,
                              textAlign: paragraph.textAlign ?? undefined,
                              paddingInlineStart: paragraph.indentPx ? `${Math.min(paragraph.indentPx, 160)}px` : undefined,
                            }}
                            dangerouslySetInnerHTML={{ __html: paragraph.html || '' }}
                          />
                        ) : (
                          <p
                            style={{
                              margin: 0,
                              textAlign: paragraph.textAlign ?? undefined,
                              paddingInlineStart: paragraph.indentPx ? `${Math.min(paragraph.indentPx, 160)}px` : undefined,
                            }}
                          >
                            {textSegments.map((segment, index) => (
                              segment.highlighted ? (
                                <span key={`${paragraph.id}-hl-${index}`} className="bookstream-inline-annotation">
                                  <span className="bookstream-word-highlight">{segment.text}</span>
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
                                      {badge.kind === 'reaction' ? badge.emoji || '•' : badge.kind === 'quote' ? '»' : '✎'}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span key={`${paragraph.id}-txt-${index}`}>{segment.text}</span>
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

              {isActiveSection && (
                <div style={{ marginTop: '1.5rem' }}>
                  <CommentsSection
                    chapterId={section.chapter.id}
                    onSendComment={onSendComment}
                    sectionRef={commentsSectionRef}
                    authorSlug={authorSlug}
                    bookSlug={bookSlug}
                  />
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'var(--r-bg-secondary)',
                    color: 'var(--r-text-secondary)',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                  }}
                >
                  {section.nextChapterId ? 'Следующая глава ниже' : 'Конец книги'}
                </span>
              </div>
            </section>
          )
        })}

        {(loadingNext || hasMoreNext) && (
          <div style={{ textAlign: 'center', padding: '0.5rem 0 1.5rem', color: 'var(--r-text-secondary)', fontSize: '0.8125rem' }}>
            {loadingNext ? 'Подгружаем следующую главу...' : 'Прокрутите ниже для продолжения'}
          </div>
        )}
      </div>
      <div ref={bottomSentinelRef} style={{ height: '1px' }} />
      <div style={{ height: '2rem' }} />
    </div>
  )
}
