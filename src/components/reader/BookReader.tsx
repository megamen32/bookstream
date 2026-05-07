'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useReaderStore } from '@/lib/store'
import TextSelector from './TextSelector'
import type { SelectionAnnotationRange } from './TextSelector'
import CommentsSection from './CommentsSection'
import ReactionBar from './ReactionBar'
import type { CommentSubmitHandler } from './comment-types'
import { MessageSquare, X } from 'lucide-react'
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
  html?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify' | null
  indentPx?: number
}

interface BookReaderProps {
  paragraphs: Paragraph[]
  variantId: string
  hasNextChapter: boolean
  hasPrevChapter: boolean
  onNextChapter: () => void
  onPrevChapter: () => void
  chapterTitle: string
  onSendComment: CommentSubmitHandler
  commentCount: number
  /** Callback with progress (0-1) for progress bar */
  onProgress?: (percent: number) => void
  /** Currently bookmarked paragraph stableKey */
  bookmarkedKey?: string | null
  /** Callback to toggle bookmark */
  onToggleBookmark?: (stableKey: string) => void
  /** Search panel open state */
  searchOpen: boolean
  /** Callback used to expose the active content node for search */
  setContentNode?: (node: HTMLDivElement | null) => void
  /** Book route slugs used for quote links in comments */
  authorSlug: string
  bookSlug: string
  /** Database paragraph id requested via quote navigation */
  highlightParagraphId?: string | null
  /** Optional end paragraph id for a multi-paragraph quote range */
  highlightParagraphEndId?: string | null
}

export default function BookReader({
  paragraphs,
  variantId,
  hasNextChapter,
  hasPrevChapter,
  onNextChapter,
  onPrevChapter,
  chapterTitle,
  onSendComment,
  commentCount,
  onProgress,
  bookmarkedKey,
  onToggleBookmark,
  searchOpen,
  setContentNode,
  authorSlug,
  bookSlug,
  highlightParagraphId,
  highlightParagraphEndId,
}: BookReaderProps) {
  const { fontSize, lineHeight, lineWidth, theme, bookId, chapterId, readerId, readingMode, showMobileReactionBar } = useReaderStore()
  const innerRef = useRef<HTMLDivElement>(null)
  const contentRefInternal = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showMenu, setShowMenu] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentsHeight, setCommentsHeight] = useState(280)
  const restoredRef = useRef(false)
  const quoteFocusAppliedRef = useRef(false)
  const quoteHighlightNodesRef = useRef<HTMLElement[]>([])
  const [selectionHighlights, setSelectionHighlights] = useState<SelectionAnnotationRange[]>([])
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTransitioning = useRef(false)
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

    if (!highlightParagraphId || !contentRefInternal.current) return

    const frameId = window.requestAnimationFrame(() => {
      if (!contentRefInternal.current) return
      const target = findQuoteParagraphElement(contentRefInternal.current, highlightParagraphId)
      if (!target) return

      const frames = collectParagraphRangeElements(
        contentRefInternal.current,
        highlightParagraphId,
        highlightParagraphEndId,
      )
      for (const node of frames) {
        node.classList.add('bookstream-quote-frame')
      }
      quoteHighlightNodesRef.current = frames

      scrollQuoteTargetIntoView(contentRefInternal.current, target)
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

  const columnWidth = lineWidth === 'narrow' ? '280px' : lineWidth === 'medium' ? '350px' : '420px'

  // Calculate pages based on content height
  useEffect(() => {
    const el = contentRefInternal.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const totalWidth = el.scrollWidth
      const pageWidth = el.clientWidth
      const pages = pageWidth > 0 ? Math.max(1, Math.ceil(totalWidth / pageWidth)) : 1
      setTotalPages(pages)
      if (currentPage > pages) setCurrentPage(Math.max(1, pages))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [lineWidth, fontSize, lineHeight, paragraphs, currentPage, showComments])

  // Restore page position
  useEffect(() => {
    if (restoredRef.current || !contentRefInternal.current || (highlightParagraphId && !quoteFocusAppliedRef.current)) return
    restoredRef.current = true
    const savedPage = localStorage.getItem(`bookstream-page-${chapterId}`)
    if (savedPage) {
      const page = parseInt(savedPage, 10)
      if (!isNaN(page) && page > 0) {
        requestAnimationFrame(() => setCurrentPage(page))
      }
    }
  }, [chapterId])

  // Scroll to current page
  useEffect(() => {
    if (!contentRefInternal.current || !restoredRef.current || (highlightParagraphId && !quoteFocusAppliedRef.current)) return
    const pageWidth = contentRefInternal.current.clientWidth
    contentRefInternal.current.scrollLeft = (currentPage - 1) * pageWidth
  }, [currentPage, highlightParagraphId])

  // Report progress
  useEffect(() => {
    if (totalPages > 1) {
      onProgress?.((currentPage - 1) / (totalPages - 1))
    } else {
      onProgress?.(1)
    }
  }, [currentPage, totalPages, onProgress])

  const saveProgress = useCallback((page: number) => {
    if (!bookId || !chapterId || !readerId) return
    localStorage.setItem(`bookstream-page-${chapterId}`, String(page))
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const scrollPercent = totalPages > 1 ? (page - 1) / (totalPages - 1) : 0
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readerId, bookId, chapterId,
            variantType: useReaderStore.getState().variantType,
            scrollPercent, fontSize, lineHeight, theme, readingMode,
          }),
        })
      } catch (e) {
        console.error('Failed to save progress:', e)
      }
    }, 2000)
  }, [bookId, chapterId, readerId, fontSize, lineHeight, theme, readingMode, totalPages])

  const goNext = useCallback(() => {
    setCurrentPage(prev => {
      if (prev >= totalPages) {
        if (hasNextChapter && !isTransitioning.current) {
          isTransitioning.current = true
          onNextChapter()
          setTimeout(() => {
            setCurrentPage(1)
            restoredRef.current = true
            isTransitioning.current = false
          }, 100)
        }
        return prev
      }
      const next = prev + 1
      saveProgress(next)
      return next
    })
  }, [totalPages, saveProgress, hasNextChapter, onNextChapter])

  const goPrev = useCallback(() => {
    setCurrentPage(prev => {
      if (prev <= 1) {
        if (hasPrevChapter && !isTransitioning.current) {
          isTransitioning.current = true
          onPrevChapter()
          setTimeout(() => {
            restoredRef.current = false
            isTransitioning.current = false
          }, 100)
        }
        return prev
      }
      const next = prev - 1
      saveProgress(next)
      return next
    })
  }, [saveProgress, hasPrevChapter, onPrevChapter])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showComments) return // don't intercept when comments open
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        goPrev()
      }
    }

    const handleShowComments = () => {
      setShowComments(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('bookstream:show-comments', handleShowComments)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('bookstream:show-comments', handleShowComments)
    }
  }, [goNext, goPrev, showComments])

  // Touch swipe handling
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (showComments) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext()
      else goPrev()
    }
  }

  const handleTapZone = (zone: 'left' | 'center' | 'right') => {
    if (zone === 'left') goPrev()
    else if (zone === 'right') goNext()
    else setShowMenu(prev => !prev)
  }

  const handleBookmarkClick = useCallback((e: React.MouseEvent, stableKey: string) => {
    e.stopPropagation()
    onToggleBookmark?.(stableKey)
  }, [onToggleBookmark])

  return (
    <div
      ref={innerRef}
      style={{ position: 'relative', height: '100%', overflow: 'hidden' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Scrollable content container */}
      <div
        ref={(node) => {
          contentRefInternal.current = node
          setContentNode?.(showComments ? null : node)
        }}
        style={{
          columnWidth: columnWidth,
          columnGap: '2rem',
          columnFill: 'auto',
          height: '100%',
          overflow: 'hidden',
          padding: '1.5rem 1rem',
          fontSize: `${fontSize}px`,
          lineHeight: `${lineHeight}`,
        }}
      >
        <div style={{ position: 'relative' }}>
          <div
            style={{
              columnSpan: 'all',
              breakInside: 'avoid',
              margin: '0 0 1.5rem',
              padding: '0 0 1rem',
              textAlign: 'center',
            }}
          >
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
              {chapterTitle}
            </h1>
          </div>
          <TextSelector containerRef={contentRefInternal} variantId={variantId} onSelectionAnnotation={handleSelectionAnnotation} />
          {paragraphs.map((p) => {
            const isQuoteTarget = highlightParagraphId === p.id
            const ranges = getTextRangesForParagraph(p.id)
            const hasSelectionHighlight = ranges.length > 0
            const textSegments = splitTextByAnnotationRanges(p.text, ranges)
            const canRenderRichParagraph = !hasSelectionHighlight && Boolean(p.html)

            return (
              <div
                key={p.stableKey || p.id}
                className="group"
                style={{
                  position: 'relative',
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
                      right: '0.5rem',
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
                  style={{
                    breakInside: 'avoid',
                    marginBottom: '0.5em',
                    textAlign: p.textAlign ?? 'justify',
                    hyphens: 'auto',
                    color: 'var(--r-text)',
                    fontFamily: 'Georgia, "Times New Roman", Times, serif',
                    paddingInlineStart: p.indentPx ? `${Math.min(p.indentPx, 160)}px` : undefined,
                  }}
                >
                  {canRenderRichParagraph ? (
                    <p style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: p.html || '' }} />
                  ) : (
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
                  )}
                </article>
                <ReactionBar paragraphId={p.id} variantId={variantId} showOnMobile={showMobileReactionBar} />
              </div>
            )
          })}

          {/* End hint */}
          <div style={{ breakInside: 'avoid', textAlign: 'center', padding: '1rem 0' }}>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: 'var(--r-bg-secondary)',
                color: 'var(--r-text-secondary)',
                padding: '0.375rem 1rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
              }}
            >
              {hasNextChapter ? 'Листните &rarr; следующая глава' : 'Конец книги'}
            </span>
          </div>
        </div>
      </div>

      {/* Tap zones */}
      <div className="tap-zone tap-zone-left" onClick={() => handleTapZone('left')} />
      <div className="tap-zone tap-zone-center" onClick={() => handleTapZone('center')} />
      <div className="tap-zone tap-zone-right" onClick={() => handleTapZone('right')} />

      {/* Page indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--r-bg-secondary)',
          color: 'var(--r-text-secondary)',
          padding: '0.25rem 0.75rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          zIndex: 20,
          opacity: showMenu ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: showMenu ? 'auto' : 'none',
        }}
      >
        {currentPage} / {totalPages}
      </div>

      {/* Comments button (bottom-right, always visible) */}
      <button
        onClick={() => setShowComments(true)}
        style={{
          position: 'absolute',
          bottom: '0.75rem',
          right: '0.75rem',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: 'var(--r-accent)',
          color: 'var(--r-accent-foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.125rem',
          border: 'none',
          cursor: 'pointer',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'transform 0.2s ease',
        }}
        title="Комментарии"
      >
        <MessageSquare size={20} />
        {commentCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: '0.625rem',
            fontWeight: 700,
            width: '1.125rem',
            height: '1.125rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {commentCount > 99 ? '99+' : commentCount}
          </span>
        )}
      </button>

      {/* Slide-up Comments Panel (Telegram-style) */}
      {showComments && (
        <div
          className="slide-up-enter"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: commentsHeight,
            maxHeight: '70%',
            backgroundColor: 'var(--r-bg)',
            borderTop: '1px solid var(--r-border)',
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            borderRadius: '1rem 1rem 0 0',
          }}
        >
          {/* Drag handle + close button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem 1rem 0.375rem',
              position: 'relative',
              cursor: 'ns-resize',
              flexShrink: 0,
            }}
            onMouseDown={(e) => {
              const startY = e.clientY
              const startH = commentsHeight
              const onMove = (ev: MouseEvent) => {
                const delta = startY - ev.clientY
                setCommentsHeight(Math.max(200, Math.min(window.innerHeight * 0.7, startH + delta)))
              }
              const onUp = () => {
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
              }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
          >
            <div style={{
              width: '2.5rem',
              height: '0.25rem',
              borderRadius: '9999px',
              backgroundColor: 'var(--r-border)',
            }} />
            <button
              onClick={() => setShowComments(false)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--r-text-secondary)',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Comments content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1rem' }}>
          <CommentsSection
            chapterId={chapterId || ''}
            onSendComment={onSendComment}
            authorSlug={authorSlug}
            bookSlug={bookSlug}
          />
        </div>
        </div>
      )}
    </div>
  )
}
