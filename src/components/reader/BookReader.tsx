'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useReaderStore } from '@/lib/store'
import TextSelector from './TextSelector'
import CommentsSection from './CommentsSection'

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
}: BookReaderProps) {
  const { fontSize, lineHeight, lineWidth, theme, bookId, chapterId, readerId, readingMode } = useReaderStore()
  const contentRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showMenu, setShowMenu] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const restoredRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTransitioning = useRef(false)

  const columnWidth = lineWidth === 'narrow' ? '280px' : lineWidth === 'medium' ? '350px' : '420px'

  // Calculate pages based on content height
  useEffect(() => {
    if (!contentRef.current) return
    const observer = new ResizeObserver(() => {
      const el = contentRef.current
      if (!el) return
      const totalHeight = el.scrollHeight
      const pageHeight = el.clientHeight
      const pages = Math.max(1, Math.ceil(totalHeight / pageHeight))
      setTotalPages(pages)
      if (currentPage > pages) setCurrentPage(Math.max(1, pages))
    })
    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [lineWidth, fontSize, lineHeight, paragraphs, currentPage, showComments])

  // Restore page position
  useEffect(() => {
    if (restoredRef.current || !contentRef.current) return
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
    if (!contentRef.current || !restoredRef.current) return
    const pageHeight = contentRef.current.clientHeight
    contentRef.current.scrollTop = (currentPage - 1) * pageHeight
  }, [currentPage])

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
        // End of text pages → show comments page
        if (!showComments && commentCount >= 0) {
          setShowComments(true)
          return prev
        }
        // End of comments page → next chapter
        if (hasNextChapter && !isTransitioning.current) {
          isTransitioning.current = true
          onNextChapter()
          setTimeout(() => {
            setCurrentPage(1)
            restoredRef.current = true
            setShowComments(false)
            isTransitioning.current = false
          }, 100)
        }
        return prev
      }
      const next = prev + 1
      saveProgress(next)
      return next
    })
  }, [totalPages, saveProgress, hasNextChapter, onNextChapter, showComments, commentCount])

  const goPrev = useCallback(() => {
    setCurrentPage(prev => {
      // If on first page of comments → hide comments
      if (showComments && prev === 1) {
        setShowComments(false)
        return 1
      }
      if (prev <= 1) {
        if (hasPrevChapter && !isTransitioning.current) {
          isTransitioning.current = true
          onPrevChapter()
          setTimeout(() => {
            restoredRef.current = false
            setShowComments(false)
            isTransitioning.current = false
          }, 100)
        }
        return prev
      }
      const next = prev - 1
      saveProgress(next)
      return next
    })
  }, [saveProgress, hasPrevChapter, onPrevChapter, showComments])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        goPrev()
      }
    }

    // Listen for custom event from parent to show comments
    const handleShowComments = () => {
      if (!showComments) {
        // Jump to last page first, then show comments on next swipe
        setCurrentPage(totalPages)
        setTimeout(() => setShowComments(true), 100)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('bookstream:show-comments', handleShowComments)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('bookstream:show-comments', handleShowComments)
    }
  }, [goNext, goPrev, showComments, totalPages])

  // Touch swipe handling
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
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

  const isAtStart = currentPage <= 1 && !showComments
  const isAtEnd = currentPage >= totalPages && !showComments

  return (
    <div
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
        {showComments ? 'Комментарии' : chapterTitle}
      </div>

      {/* Scrollable content container */}
      <div
        ref={contentRef}
        style={{
          columnWidth: showComments ? undefined : columnWidth,
          columnGap: '2rem',
          columnFill: 'auto',
          height: '100%',
          overflow: 'hidden',
          padding: '1.5rem 1rem',
          fontSize: `${fontSize}px`,
          lineHeight: `${lineHeight}`,
        }}
      >
        {showComments ? (
          /* Comments page — single column, no pagination feel */
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <CommentsSection
              chapterId={chapterId || ''}
              onSendComment={onSendComment}
            />
          </div>
        ) : (
          /* Text content — columnar */
          <div style={{ position: 'relative' }}>
            <TextSelector containerRef={contentRef} variantId={variantId} />
            {paragraphs.map((p) => (
              <article
                key={p.stableKey || p.id}
                data-paragraph-id={p.id}
                data-stable-key={p.stableKey}
                style={{ breakInside: 'avoid', marginBottom: '1em', textAlign: 'justify', hyphens: 'auto', color: 'var(--r-text)', fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
              >
                <p style={{ margin: 0 }}>{p.text}</p>
              </article>
            ))}

            {/* Hint to swipe right for comments at end of text */}
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
                {hasNextChapter ? 'Листните &rarr; за комментариями, потом &rarr; следующая глава' : 'Листните &rarr; к комментариям'}
              </span>
            </div>
          </div>
        )}
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
        {showComments ? '💬' : `${currentPage} / ${totalPages}`}
      </div>
    </div>
  )
}
