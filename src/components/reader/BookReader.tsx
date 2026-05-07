'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useReaderStore } from '@/lib/store'
import TextSelector from './TextSelector'
import type { SelectionAnnotationRange } from './TextSelector'
import ReactionBar from './ReactionBar'
import './BookReader.css'
import { collectParagraphRangeElements } from '@/lib/paragraph-selection'
import {
  buildAnnotationParagraphRanges,
  splitTextByAnnotationRanges,
  type AnnotationParagraphRange,
  type UnifiedAnnotationItem,
} from '@/lib/annotations'
import {
  getBookReaderPageStorageKey,
  resolveBookReaderPage,
  setBookReaderPage,
} from '@/lib/book-reader-progress'

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
  onProgress?: (percent: number) => void
  setContentNode?: (node: HTMLDivElement | null) => void
  highlightParagraphId?: string | null
  highlightParagraphEndId?: string | null
  highlightStartOffset?: number | null
  highlightEndOffset?: number | null
  prefetchNextChapter?: () => Promise<void> | void
  prefetchPrevChapter?: () => Promise<void> | void
  bookProgressPercent: number
  onCenterTap?: () => void
  onNavigate?: () => void
}

interface PointerGestureState {
  pointerId: number
  pointerType: string
  clientX: number
  clientY: number
}

export default function BookReader({
  paragraphs,
  variantId,
  hasNextChapter,
  hasPrevChapter,
  onNextChapter,
  onPrevChapter,
  chapterTitle,
  onProgress,
  setContentNode,
  highlightParagraphId,
  highlightParagraphEndId,
  highlightStartOffset,
  highlightEndOffset,
  prefetchNextChapter,
  prefetchPrevChapter,
  bookProgressPercent,
  onCenterTap,
  onNavigate,
}: BookReaderProps) {
  const {
    fontSize,
    lineHeight,
    theme,
    bookId,
    chapterId,
    readerId,
    variantType,
    readingMode,
    showMobileReactionBar,
  } = useReaderStore()

  const shellRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pageAreaRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const activePageRef = useRef<HTMLDivElement>(null)

  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [pages, setPages] = useState<Paragraph[][]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [showHud, setShowHud] = useState(false)
  const [selectionHighlights, setSelectionHighlights] = useState<SelectionAnnotationRange[]>([])
  const [chapterTransition, setChapterTransition] = useState<'idle' | 'next' | 'prev'>('idle')

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quoteFocusAppliedRef = useRef(false)
  const quoteHighlightNodesRef = useRef<HTMLElement[]>([])
  const isSwitchingChapterRef = useRef(false)
  const prefetchNextStartedRef = useRef(false)
  const prefetchPrevStartedRef = useRef(false)
  const pointerGestureRef = useRef<PointerGestureState | null>(null)

  const totalPages = Math.max(1, pages.length)
  const paragraphIndexMap = useMemo(
    () => new Map(paragraphs.map((paragraph, index) => [paragraph.id, index])),
    [paragraphs],
  )
  const hasPreciseQuoteHighlight = Number.isFinite(highlightStartOffset) && Number.isFinite(highlightEndOffset)
  const quoteHighlightRanges = useMemo(() => {
    if (!highlightParagraphId || !hasPreciseQuoteHighlight) {
      return []
    }

    return buildAnnotationParagraphRanges(
      [{
        kind: 'quote',
        paragraphId: highlightParagraphId,
        endParagraphId: highlightParagraphEndId || highlightParagraphId,
        startOffset: Number(highlightStartOffset),
        endOffset: Number(highlightEndOffset),
        selectedText: null,
        emoji: null,
      }],
      paragraphs,
      paragraphIndexMap,
    )
  }, [hasPreciseQuoteHighlight, highlightEndOffset, highlightParagraphEndId, highlightParagraphId, highlightStartOffset, paragraphIndexMap, paragraphs])

  const getTextRangesForParagraph = useCallback(
    (paragraphId: string): AnnotationParagraphRange[] => {
      const ranges = buildAnnotationParagraphRanges(selectionHighlights, paragraphs, paragraphIndexMap)
      return [...ranges, ...quoteHighlightRanges].filter((range) => range.paragraphId === paragraphId)
    },
    [paragraphIndexMap, paragraphs, quoteHighlightRanges, selectionHighlights],
  )

  const showTemporaryHud = useCallback(() => {
    setShowHud(true)

    if (hudTimeoutRef.current) {
      clearTimeout(hudTimeoutRef.current)
    }

    hudTimeoutRef.current = setTimeout(() => {
      setShowHud(false)
    }, 1100)
  }, [])

  const startPrefetchNext = useCallback(() => {
    if (!hasNextChapter || !prefetchNextChapter || prefetchNextStartedRef.current) return

    prefetchNextStartedRef.current = true

    try {
      void prefetchNextChapter()
    } catch (error) {
      console.error('Failed to prefetch next chapter:', error)
    }
  }, [hasNextChapter, prefetchNextChapter])

  const startPrefetchPrev = useCallback(() => {
    if (!hasPrevChapter || !prefetchPrevChapter || prefetchPrevStartedRef.current) return

    prefetchPrevStartedRef.current = true

    try {
      void prefetchPrevChapter()
    } catch (error) {
      console.error('Failed to prefetch previous chapter:', error)
    }
  }, [hasPrevChapter, prefetchPrevChapter])

  useEffect(() => {
    if (currentPage >= Math.max(1, totalPages - 1)) {
      startPrefetchNext()
    }

    if (currentPage <= 2) {
      startPrefetchPrev()
    }
  }, [currentPage, totalPages, startPrefetchNext, startPrefetchPrev])

  useEffect(() => {
    const pageArea = pageAreaRef.current
    if (!pageArea) return

    const updateSize = () => {
      setPageSize({
        width: Math.floor(pageArea.clientWidth),
        height: Math.floor(pageArea.clientHeight),
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(pageArea)
    window.addEventListener('resize', updateSize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  useEffect(() => {
    quoteFocusAppliedRef.current = false
  }, [chapterId, highlightParagraphId, highlightParagraphEndId])

  useEffect(() => {
    if (!readerId || !bookId || !chapterId) return

    const controller = new AbortController()

    const loadSelectionHighlights = async (): Promise<void> => {
      try {
        const params = new URLSearchParams({ readerId, bookId })

        const response = await fetch(`/api/annotations?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) return

        const data = (await response.json()) as {
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

  const handleSelectionAnnotation = useCallback((range: SelectionAnnotationRange, active: boolean) => {
    setSelectionHighlights((current) => {
      const isSameRange = (entry: SelectionAnnotationRange) =>
        entry.kind === range.kind &&
        entry.paragraphId === range.paragraphId &&
        entry.endParagraphId === range.endParagraphId &&
        entry.startOffset === range.startOffset &&
        entry.endOffset === range.endOffset &&
        entry.emoji === range.emoji &&
        entry.body === range.body

      if (!active) {
        return current.filter((entry) => !isSameRange(entry))
      }

      return current.some(isSameRange) ? current : [...current, range]
    })
  }, [])

  useEffect(() => {
    if (!measureRef.current || pageSize.width <= 0 || pageSize.height <= 0) return

    const measure = measureRef.current
    const result: Paragraph[][] = []
    let current: Paragraph[] = []
    let isFirstPage = true

    const makeChapterHeaderNode = (): HTMLElement => {
      const header = document.createElement('header')
      header.className = 'book-reader-chapter-header'

      const title = document.createElement('h1')
      title.className = 'book-reader-chapter-title'
      title.textContent = chapterTitle

      header.appendChild(title)
      return header
    }

    const resetMeasure = (): void => {
      measure.innerHTML = ''

      if (isFirstPage) {
        measure.appendChild(makeChapterHeaderNode())
      }
    }

    const makeParagraphNode = (paragraph: Paragraph) => {
      const wrapper = document.createElement('section')
      wrapper.className = 'book-reader-paragraph-shell'

      const article = document.createElement('article')
      article.className = 'book-reader-paragraph'
      article.style.textAlign = paragraph.textAlign ?? 'justify'

      if (paragraph.indentPx) {
        article.style.paddingInlineStart = `${Math.min(paragraph.indentPx, 72)}px`
      }

      const p = document.createElement('p')

      if (paragraph.html) {
        p.innerHTML = paragraph.html
      } else {
        p.textContent = paragraph.text
      }

      article.appendChild(p)
      wrapper.appendChild(article)

      /**
       * The rendered paragraph includes a reaction bar on wider viewports.
       * It must be included in measurement too, otherwise page splitting
       * underestimates the real height and the bottom of the content gets cut off.
       */
      if (window.matchMedia('(min-width: 768px)').matches) {
        const reactionBar = document.createElement('div')
        reactionBar.className = 'reaction-bar items-center gap-1 pt-2 md:flex md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
        reactionBar.style.display = 'flex'
        reactionBar.style.visibility = 'hidden'
        reactionBar.style.pointerEvents = 'none'
        reactionBar.style.minHeight = '1.9rem'
        wrapper.appendChild(reactionBar)
      }

      return wrapper
    }

    const commitPage = (): void => {
      if (current.length > 0 || isFirstPage) {
        result.push(current)
        current = []
        isFirstPage = false
        resetMeasure()
      }
    }

    resetMeasure()

    for (const paragraph of paragraphs) {
      const node = makeParagraphNode(paragraph)
      measure.appendChild(node)

      const tooTall = measure.scrollHeight > pageSize.height

      if (tooTall) {
        measure.removeChild(node)
        commitPage()

        current.push(paragraph)
        measure.appendChild(makeParagraphNode(paragraph))
      } else {
        current.push(paragraph)
      }

      /**
       * Если один абзац сам по себе выше страницы, он всё равно останется на странице.
       * Иначе бесконечно резать текст нельзя без отдельного алгоритма line-breaking.
       */
      if (measure.scrollHeight > pageSize.height && current.length === 1) {
        commitPage()
      }
    }

    commitPage()

    setPages(result.length > 0 ? result : [[]])

    if (!chapterId) {
      setCurrentPage(1)
      return
    }

    const savedPage = localStorage.getItem(getBookReaderPageStorageKey(chapterId))

    setCurrentPage(() => resolveBookReaderPage(savedPage, result.length))
  }, [paragraphs, pageSize.width, pageSize.height, fontSize, lineHeight, chapterId, chapterTitle])

  useEffect(() => {
    if (!highlightParagraphId || quoteFocusAppliedRef.current || pages.length === 0) return

    const targetPageIndex = pages.findIndex((page) =>
      page.some((paragraph) =>
        paragraph.id === highlightParagraphId || paragraph.id === highlightParagraphEndId,
      ),
    )

    if (targetPageIndex < 0) return

    quoteFocusAppliedRef.current = true
    const frameId = window.requestAnimationFrame(() => {
      setCurrentPage(targetPageIndex + 1)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [highlightParagraphEndId, highlightParagraphId, pages])

  useEffect(() => {
    for (const node of quoteHighlightNodesRef.current) {
      node.classList.remove('bookstream-quote-frame')
    }

    quoteHighlightNodesRef.current = []

    if (!highlightParagraphId || !activePageRef.current || pages.length === 0 || hasPreciseQuoteHighlight) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!activePageRef.current) {
        return
      }

      const frames = collectParagraphRangeElements(
        activePageRef.current,
        highlightParagraphId,
        highlightParagraphEndId,
      )

      for (const node of frames) {
        node.classList.add('bookstream-quote-frame')
      }

      quoteHighlightNodesRef.current = frames
    })

    return () => {
      window.cancelAnimationFrame(frameId)

      for (const node of quoteHighlightNodesRef.current) {
        node.classList.remove('bookstream-quote-frame')
      }

      quoteHighlightNodesRef.current = []
    }
  }, [currentPage, hasPreciseQuoteHighlight, highlightParagraphEndId, highlightParagraphId, pages])

  useEffect(() => {
    if (totalPages > 1) {
      onProgress?.((currentPage - 1) / (totalPages - 1))
    } else {
      onProgress?.(1)
    }
  }, [currentPage, totalPages, onProgress])

  const saveProgress = useCallback(
    (page: number) => {
      if (!bookId || !chapterId || !readerId) return

      setBookReaderPage(localStorage, chapterId, page)

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const scrollPercent = totalPages > 1 ? (page - 1) / (totalPages - 1) : 0

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
        } catch (error) {
          console.error('Failed to save progress:', error)
        }
      }, 1000)
    },
    [bookId, chapterId, readerId, fontSize, lineHeight, theme, readingMode, totalPages],
  )

  const switchToNextChapter = useCallback(() => {
    if (!hasNextChapter || isSwitchingChapterRef.current) return

    isSwitchingChapterRef.current = true
    setChapterTransition('next')
    startPrefetchNext()

    window.setTimeout(() => {
      onNextChapter()

      window.requestAnimationFrame(() => {
        setChapterTransition('idle')
        isSwitchingChapterRef.current = false
      })
    }, 120)
  }, [hasNextChapter, onNextChapter, startPrefetchNext])

  const switchToPrevChapter = useCallback(() => {
    if (!hasPrevChapter || isSwitchingChapterRef.current) return

    isSwitchingChapterRef.current = true
    setChapterTransition('prev')
    startPrefetchPrev()

    window.setTimeout(() => {
      onPrevChapter()

      window.requestAnimationFrame(() => {
        setChapterTransition('idle')
        isSwitchingChapterRef.current = false
      })
    }, 120)
  }, [hasPrevChapter, onPrevChapter, startPrefetchPrev])

  const goNext = useCallback(() => {
    onNavigate?.()

    setCurrentPage((prev) => {
      if (prev >= totalPages) {
        switchToNextChapter()
        return prev
      }

      const next = prev + 1
      saveProgress(next)
      showTemporaryHud()

      return next
    })
  }, [onNavigate, totalPages, saveProgress, showTemporaryHud, switchToNextChapter])

  const goPrev = useCallback(() => {
    onNavigate?.()

    setCurrentPage((prev) => {
      if (prev <= 1) {
        switchToPrevChapter()
        return prev
      }

      const next = prev - 1
      saveProgress(next)
      showTemporaryHud()

      return next
    })
  }, [onNavigate, saveProgress, showTemporaryHud, switchToPrevChapter])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ') {
        event.preventDefault()
        goNext()
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        goPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [goNext, goPrev])

  const clearPointerGesture = useCallback(() => {
    pointerGestureRef.current = null
  }, [])

  const isInteractiveTarget = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    return Boolean(target.closest(
      'button, a, input, textarea, select, label, [role="dialog"], .selection-toolbar',
    ))
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      clearPointerGesture()
      return
    }

    pointerGestureRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      clientX: event.clientX,
      clientY: event.clientY,
    }
  }, [clearPointerGesture])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current
    clearPointerGesture()

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return
    }

    if (isInteractiveTarget(event.target)) {
      return
    }

    const dx = event.clientX - gesture.clientX
    const dy = event.clientY - gesture.clientY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (gesture.pointerType === 'touch' && absDx >= 36 && absDx > absDy * 1.15) {
      if (dx < 0) {
        goNext()
      } else {
        goPrev()
      }
      return
    }

    if (absDx > 8 || absDy > 8) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = (event.clientX - bounds.left) / Math.max(bounds.width, 1)

    window.setTimeout(() => {
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) {
        return
      }

      if (relativeX <= 0.3) {
        goPrev()
        return
      }

      if (relativeX >= 0.7) {
        goNext()
        return
      }

      onCenterTap?.()
    }, 0)
  }, [clearPointerGesture, goNext, goPrev, isInteractiveTarget, onCenterTap])

  const handlePointerCancel = useCallback(() => {
    clearPointerGesture()
  }, [clearPointerGesture])

  const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.buttons & 1) === 0) {
      clearPointerGesture()
    }
  }, [clearPointerGesture])

  const renderParagraph = (paragraph: Paragraph) => {
    const isQuoteTarget = highlightParagraphId === paragraph.id && !hasPreciseQuoteHighlight
    const ranges = getTextRangesForParagraph(paragraph.id)
    const hasSelectionHighlight = ranges.length > 0
    const textSegments = splitTextByAnnotationRanges(paragraph.text, ranges)
    const canRenderRichParagraph = !hasSelectionHighlight && Boolean(paragraph.html)

    return (
      <section
        key={paragraph.stableKey || paragraph.id}
        className={[
          'book-reader-paragraph-shell',
          isQuoteTarget ? 'is-quote-target' : '',
          hasSelectionHighlight ? 'has-user-mark' : '',
        ].join(' ')}
      >
        {isQuoteTarget && (
          <span className="book-reader-quote-pill">
            Цитата
          </span>
        )}

        <article
          data-paragraph-id={paragraph.id}
          data-stable-key={paragraph.stableKey}
          className="book-reader-paragraph"
          style={{
            textAlign: paragraph.textAlign ?? 'justify',
            paddingInlineStart: paragraph.indentPx
              ? `${Math.min(paragraph.indentPx, 72)}px`
              : undefined,
          }}
        >
          {canRenderRichParagraph ? (
            <p dangerouslySetInnerHTML={{ __html: paragraph.html || '' }} />
          ) : (
            <p>
              {textSegments.map((segment, index) =>
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
                ),
              )}
            </p>
          )}
        </article>

        <ReactionBar
          paragraphId={paragraph.id}
          variantId={variantId}
          showOnMobile={showMobileReactionBar}
        />
      </section>
    )
  }

  const renderChapterHeader = () => (
    <header className="book-reader-chapter-header">
      <h1 className="book-reader-chapter-title">
        {chapterTitle}
      </h1>
    </header>
  )

  return (
    <div
      ref={shellRef}
      className={`book-reader-shell chapter-${chapterTransition}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
    >
      <div ref={viewportRef} className="book-reader-viewport">
        <div ref={pageAreaRef} className="book-reader-page-area">
          <div
            ref={measureRef}
            className="book-reader-measure"
            style={{
              width: pageSize.width > 0 ? `${pageSize.width}px` : undefined,
              fontSize: `${fontSize}px`,
              lineHeight: `${lineHeight}`,
            }}
          />

          <div
            ref={(node) => {
              activePageRef.current = node
              setContentNode?.(node)
            }}
            className="book-reader-pages-track"
            style={{
              width: `${totalPages * pageSize.width}px`,
              transform: `translate3d(-${(currentPage - 1) * pageSize.width}px, 0, 0)`,
            }}
          >
            {pages.map((page, pageIndex) => (
              <div
                key={`${chapterId}-page-${pageIndex}`}
                className="book-reader-page"
                style={{
                  width: pageSize.width > 0 ? `${pageSize.width}px` : '100%',
                  fontSize: `${fontSize}px`,
                  lineHeight: `${lineHeight}`,
                }}
              >
                <div
                  className="book-reader-page-inner"
                  data-chapter-id={chapterId || undefined}
                  data-variant-id={variantId}
                  data-variant-type={variantType}
                >
                  {pageIndex === 0 && renderChapterHeader()}
                  {page.map(renderParagraph)}

                  {pageIndex === pages.length - 1 && (
                    <footer className="book-reader-end">
                      <span>
                        {hasNextChapter ? 'Листните дальше →' : 'Конец книги'}
                      </span>
                    </footer>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TextSelector
        containerRef={activePageRef}
        variantId={variantId}
        onSelectionAnnotation={handleSelectionAnnotation}
      />

      <div
        className={`book-reader-hud ${showHud ? 'is-visible' : ''}`}
        aria-label={`Страница ${currentPage} из ${totalPages}, прогресс книги ${bookProgressPercent}%`}
      >
        <span className="book-reader-hud__current">
          {currentPage}/{totalPages}
        </span>
        <i />
        <span className="book-reader-hud__total">{bookProgressPercent}% книги</span>
      </div>
    </div>
  )
}
