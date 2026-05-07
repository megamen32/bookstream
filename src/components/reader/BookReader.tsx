'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useReaderStore } from '@/lib/store'
import TextSelector from './TextSelector'
import CommentsSection from './CommentsSection'
import ReactionBar from './ReactionBar'
import { MessageSquare, X } from 'lucide-react'

interface Paragraph {
  id: string
  stableKey: string
  position: number
  text: string
}

interface BookReaderProps {
  paragraphs: Paragraph[]
  variantId: string
  hasNextChapter: boolean
  hasPrevChapter: boolean
  onNextChapter: () => void
  onPrevChapter: () => void
  chapterTitle: string
  onSendComment: (body: string) => void
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
}: BookReaderProps) {
  const { fontSize, lineHeight, lineWidth, theme, bookId, chapterId, readerId, readingMode } = useReaderStore()
  const innerRef = useRef<HTMLDivElement>(null)
  const contentRefInternal = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showMenu, setShowMenu] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentsHeight, setCommentsHeight] = useState(280)
  const restoredRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTransitioning = useRef(false)

  const columnWidth = lineWidth === 'narrow' ? '280px' : lineWidth === 'medium' ? '350px' : '420px'

  // Calculate pages based on content height
  useEffect(() => {
    const el = contentRefInternal.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const totalHeight = el.scrollHeight
      const pageHeight = el.clientHeight
      const pages = Math.max(1, Math.ceil(totalHeight / pageHeight))
      setTotalPages(pages)
      if (currentPage > pages) setCurrentPage(Math.max(1, pages))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [lineWidth, fontSize, lineHeight, paragraphs, currentPage, showComments])

  // Restore page position
  useEffect(() => {
    if (restoredRef.current || !contentRefInternal.current) return
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
    if (!contentRefInternal.current || !restoredRef.current) return
    const pageHeight = contentRefInternal.current.clientHeight
    contentRefInternal.current.scrollTop = (currentPage - 1) * pageHeight
  }, [currentPage])

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
      {/* Chapter title overlay */}
      <div
        style={{
          position: 'absolute',
          top: '0.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.6875rem',
          color: 'var(--r-text-secondary)',
          zIndex: 15,
          pointerEvents: 'none',
          opacity: showMenu ? 1 : 0,
          transition: 'opacity 0.2s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {chapterTitle}
      </div>

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
          <TextSelector containerRef={contentRefInternal} variantId={variantId} />
          {paragraphs.map((p) => (
            <div key={p.stableKey || p.id} className="group" style={{ position: 'relative' }}>
              <article
                data-paragraph-id={p.id}
                data-stable-key={p.stableKey}
                style={{ breakInside: 'avoid', marginBottom: '0.5em', textAlign: 'justify', hyphens: 'auto', color: 'var(--r-text)', fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
              >
                <p style={{ margin: 0 }}>{p.text}</p>
              </article>
              <ReactionBar paragraphId={p.id} variantId={variantId} />
            </div>
          ))}

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
            />
          </div>
        </div>
      )}
    </div>
  )
}
