'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useReaderStore } from '@/lib/store'
import TextSelector from './TextSelector'
import type { SelectionAnnotationRange } from './TextSelector'
import CommentsSection from './CommentsSection'
import ReactionBar from './ReactionBar'
import { findQuoteParagraphElement, scrollQuoteTargetIntoView } from '@/lib/quote-navigation'
import { collectParagraphRangeElements } from '@/lib/paragraph-selection'
import {
  buildAnnotationParagraphRanges,
  splitTextByAnnotationRanges,
  type AnnotationParagraphRange,
  type UnifiedAnnotationItem,
} from '@/lib/annotations'

interface Paragraph {
  id: string
  stableKey: string
  position: number
  text: string
}

interface ChapterItem {
  id: string
  title: string
  position: number
}

interface FeedReaderProps {
  paragraphs: Paragraph[]
  variantId: string
  nextChapter?: ChapterItem | null
  onNextChapter: () => void
  /** Callback when reader requests scroll-to-comments (from toolbar button) */
  commentsSectionRef?: React.RefObject<HTMLDivElement | null>
  onSendComment: (body: string) => void
  commentCount: number
  /** Callback used to expose the scroll container for search */
  setContentNode?: (node: HTMLDivElement | null) => void
  /** Callback with scroll percent (0-1) for progress bar */
  onScrollProgress?: (percent: number) => void
  /** Currently bookmarked paragraph stableKey */
  bookmarkedKey?: string | null
  /** Callback to toggle bookmark on a paragraph */
  onToggleBookmark?: (stableKey: string) => void
  /** Book route slugs used for quote links in comments */
  authorSlug: string
  bookSlug: string
  /** Database paragraph id requested via quote navigation */
  highlightParagraphId?: string | null
  /** Optional end paragraph id for a multi-paragraph quote range */
  highlightParagraphEndId?: string | null
}

export default function FeedReader({
  paragraphs,
  variantId,
  nextChapter,
  onNextChapter,
  commentsSectionRef,
  onSendComment,
  commentCount,
  setContentNode,
  onScrollProgress,
  bookmarkedKey,
  onToggleBookmark,
  authorSlug,
  bookSlug,
  highlightParagraphId,
  highlightParagraphEndId,
}: FeedReaderProps) {
  const { fontSize, lineHeight, lineWidth, theme, bookId, chapterId, readerId, readingMode } = useReaderStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const quoteFocusAppliedRef = useRef(false)
  const quoteHighlightNodesRef = useRef<HTMLElement[]>([])
  const [selectionHighlights, setSelectionHighlights] = useState<SelectionAnnotationRange[]>([])
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showNextLoader, setShowNextLoader] = useState(false)
  const paragraphIndexMap = useMemo(() => new Map(paragraphs.map((paragraph, index) => [paragraph.id, index])), [paragraphs])

  useEffect(() => {
    quoteFocusAppliedRef.current = false
  }, [highlightParagraphId, highlightParagraphEndId])

  useEffect(() => {
    if (!readerId || !bookId || !chapterId) return

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

        const loaded = (Array.isArray(data.annotations) ? data.annotations : [])
          .filter((annotation) => annotation.chapterId === chapterId)
          .map<SelectionAnnotationRange>((annotation) => ({
            id: annotation.id,
            kind: annotation.kind,
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
  }, [readerId, bookId, chapterId])

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
      restoredRef.current = true
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      for (const node of quoteHighlightNodesRef.current) {
        node.classList.remove('bookstream-quote-frame')
      }
      quoteHighlightNodesRef.current = []
    }
  }, [highlightParagraphId, highlightParagraphEndId, paragraphs])

  const handleSelectionAnnotation = useCallback((range: SelectionAnnotationRange, active: boolean) => {
    setSelectionHighlights((current) => {
      if (!active) {
        return current.filter(
          (entry) =>
            !(
              entry.kind === range.kind &&
              entry.paragraphId === range.paragraphId &&
              entry.endParagraphId === range.endParagraphId &&
              entry.startOffset === range.startOffset &&
              entry.endOffset === range.endOffset &&
              entry.emoji === range.emoji &&
              entry.body === range.body
            ),
        )
      }

      return current.some(
        (entry) =>
          entry.kind === range.kind &&
          entry.paragraphId === range.paragraphId &&
          entry.endParagraphId === range.endParagraphId &&
          entry.startOffset === range.startOffset &&
          entry.endOffset === range.endOffset &&
          entry.emoji === range.emoji &&
          entry.body === range.body,
      )
        ? current
        : [...current, range]
    })
  }, [])

  const getTextRangesForParagraph = useCallback(
    (paragraphId: string): AnnotationParagraphRange[] => {
      const ranges = buildAnnotationParagraphRanges(selectionHighlights, paragraphs, paragraphIndexMap)
      return ranges.filter((range) => range.paragraphId === paragraphId)
    },
    [paragraphIndexMap, paragraphs, selectionHighlights],
  )

  // Restore scroll position
  useEffect(() => {
    if (restoredRef.current || !scrollRef.current || (highlightParagraphId && !quoteFocusAppliedRef.current)) return
    restoredRef.current = true

    const savedScroll = localStorage.getItem(`bookstream-scroll-${chapterId}`)
    if (savedScroll) {
      const pos = parseFloat(savedScroll)
      scrollRef.current.scrollTop = pos
    }
  }, [chapterId])

  const saveProgress = useCallback((scrollPercent: number) => {
    if (!bookId || !chapterId || !readerId) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    localStorage.setItem(`bookstream-scroll-${chapterId}`, String(scrollRef.current?.scrollTop || 0))

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readerId,
            bookId,
            chapterId,
            variantType: useReaderStore.getState().variantType,
            scrollPercent,
            fontSize,
            lineHeight,
            theme,
            readingMode,
          }),
        })
      } catch (e) {
        console.error('Failed to save progress:', e)
      }
    }, 2000)
  }, [bookId, chapterId, readerId, fontSize, lineHeight, theme, readingMode])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const scrollPercent = el.scrollHeight > el.clientHeight
      ? el.scrollTop / (el.scrollHeight - el.clientHeight)
      : 0
    saveProgress(scrollPercent)
    onScrollProgress?.(scrollPercent)

    // Show loader when near bottom and there's a next chapter
    if (nextChapter) {
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distanceToBottom < 200) {
        setShowNextLoader(true)
      } else {
        setShowNextLoader(false)
      }
    }
  }, [saveProgress, nextChapter, onScrollProgress])

  const handleLoadNextChapter = useCallback(() => {
    if (showNextLoader && nextChapter) {
      onNextChapter()
    }
  }, [showNextLoader, nextChapter, onNextChapter])

  const handleBookmarkClick = useCallback((e: React.MouseEvent, stableKey: string) => {
    e.stopPropagation()
    onToggleBookmark?.(stableKey)
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
      <div style={{ position: 'relative' }}>
        <TextSelector containerRef={scrollRef} variantId={variantId} onSelectionAnnotation={handleSelectionAnnotation} />
        <div
          className="reader-content"
          data-line-width={lineWidth}
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: `${lineHeight}`,
            maxWidth: contentMaxWidth,
            margin: '0 auto',
          }}
        >
          {paragraphs.map((p) => {
            const isQuoteTarget = highlightParagraphId === p.id
            const ranges = getTextRangesForParagraph(p.id)
            const hasSelectionHighlight = ranges.length > 0
            const textSegments = splitTextByAnnotationRanges(p.text, ranges)

            return (
              <div
                key={p.stableKey || p.id}
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
                  data-paragraph-id={p.id}
                  data-stable-key={p.stableKey}
                  style={{ marginBottom: '0.5rem' }}
                >
                  {/* Bookmark button — left side, visible on hover */}
                  <button
                    onClick={(e) => handleBookmarkClick(e, p.stableKey)}
                    title={bookmarkedKey === p.stableKey ? 'Убрать закладку' : 'Поставить закладку'}
                    style={{
                      position: 'absolute',
                      left: '-2rem',
                      top: '0',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      opacity: bookmarkedKey === p.stableKey ? 1 : 0,
                      transition: 'opacity 0.2s ease, transform 0.2s ease',
                      transform: bookmarkedKey === p.stableKey ? 'scale(1.1)' : 'scale(1)',
                      color: bookmarkedKey === p.stableKey ? 'var(--r-accent)' : 'var(--r-text-secondary)',
                      padding: '0.25rem',
                      lineHeight: 1,
                      pointerEvents: 'auto',
                    }}
                    className="bookmark-btn"
                  >
                    {bookmarkedKey === p.stableKey ? '🔖' : '📑'}
                  </button>
                  <p style={{ margin: 0 }}>
                    {textSegments.map((segment, index) =>
                      segment.highlighted ? (
                        <span key={`${p.id}-hl-${index}`} className="bookstream-inline-annotation">
                          <span className="bookstream-word-highlight">{segment.text}</span>
                          {segment.badges.map((badge, badgeIndex) => (
                            <span
                              key={`${p.id}-badge-${index}-${badgeIndex}-${badge.kind}-${badge.emoji || badge.badgeLabel}`}
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
                        <span key={`${p.id}-txt-${index}`}>{segment.text}</span>
                      ),
                    )}
                  </p>
                </article>
                {/* Reactions bar */}
                <ReactionBar paragraphId={p.id} variantId={variantId} />
              </div>
            )
          })}
        </div>

        {/* Telegram-style chapter separator at the end */}
        {nextChapter && (
          <div style={{ maxWidth: contentMaxWidth, margin: '1.5rem auto 2rem' }}>
            <div style={{ textAlign: 'center', margin: '1.5rem 0 1rem' }}>
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
                Конец главы
              </span>
            </div>

            <button
              onClick={handleLoadNextChapter}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--r-border)',
                backgroundColor: 'var(--r-bg-secondary)',
                color: 'var(--r-text)',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                textAlign: 'left',
                minHeight: '56px',
                transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--r-border)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--r-bg-secondary)'
              }}
            >
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  backgroundColor: 'var(--r-accent)',
                  color: 'var(--r-accent-foreground)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {nextChapter.position + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    marginBottom: '0.125rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {nextChapter.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--r-text-secondary)' }}>
                  Следующая глава
                </div>
              </div>
              <div style={{ color: 'var(--r-text-secondary)', fontSize: '1.25rem', flexShrink: 0 }}>
                &rarr;
              </div>
            </button>

            {showNextLoader && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '0.75rem',
                  color: 'var(--r-text-secondary)',
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ color: 'var(--r-accent)' }}>&darr;</span>
                {' '}Нажмите, чтобы продолжить
              </div>
            )}
          </div>
        )}

        {/* Book finished */}
        {!nextChapter && paragraphs.length > 0 && (
          <div style={{ textAlign: 'center', padding: '1rem 1rem 0', maxWidth: contentMaxWidth, margin: '0 auto' }}>
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
              Книга прочитана
            </span>
          </div>
        )}

        {/* Comments section — inline at the bottom of the scroll */}
        <div style={{ maxWidth: contentMaxWidth, margin: '1.5rem auto 0' }}>
          <CommentsSection
            chapterId={chapterId || ''}
            onSendComment={onSendComment}
            sectionRef={commentsSectionRef}
            authorSlug={authorSlug}
            bookSlug={bookSlug}
          />
        </div>

        {/* Bottom spacer so last comment is not cut off */}
        <div style={{ height: '2rem' }} />
      </div>
    </div>
  )
}
