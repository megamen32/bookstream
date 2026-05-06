'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useReaderStore } from '@/lib/store'
import TextSelector from './TextSelector'

interface BookReaderProps {
  paragraphs: Array<{
    id: string
    stableKey: string
    position: number
    text: string
  }>
  variantId: string
}

export default function BookReader({ paragraphs, variantId }: BookReaderProps) {
  const { fontSize, lineHeight, lineWidth, theme, bookId, chapterId, readerId, readingMode } = useReaderStore()
  const contentRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showMenu, setShowMenu] = useState(false)
  const restoredRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Calculate columns based on line width
  const columnWidth = lineWidth === 'narrow' ? '280px' : lineWidth === 'medium' ? '350px' : '420px'

  // Calculate pages
  useEffect(() => {
    if (!contentRef.current) return

    const observer = new ResizeObserver(() => {
      const el = contentRef.current
      if (!el) return
      const containerWidth = el.clientWidth
      const gap = 32 // 2rem
      const colW = lineWidth === 'narrow' ? 280 : lineWidth === 'medium' ? 350 : 420
      const cols = Math.max(1, Math.floor((containerWidth + gap) / (colW + gap)))
      const totalHeight = el.scrollHeight
      const pageHeight = el.clientHeight
      const pages = Math.max(1, Math.ceil(totalHeight / pageHeight))
      setTotalPages(pages)

      if (currentPage > pages) {
        setCurrentPage(Math.max(1, pages))
      }
    })

    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [lineWidth, fontSize, lineHeight, paragraphs, currentPage])

  // Restore page position
  useEffect(() => {
    if (restoredRef.current || !contentRef.current) return
    restoredRef.current = true

    const savedPage = localStorage.getItem(`bookstream-page-${chapterId}`)
    if (savedPage) {
      const page = parseInt(savedPage, 10)
      if (!isNaN(page) && page > 0) {
        requestAnimationFrame(() => {
          setCurrentPage(page)
        })
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
      } catch (e) {
        console.error('Failed to save progress:', e)
      }
    }, 2000)
  }, [bookId, chapterId, readerId, fontSize, lineHeight, theme, readingMode, totalPages])

  const goNext = useCallback(() => {
    setCurrentPage(prev => {
      const next = Math.min(prev + 1, totalPages)
      if (next !== prev) saveProgress(next)
      return next
    })
  }, [totalPages, saveProgress])

  const goPrev = useCallback(() => {
    setCurrentPage(prev => {
      const next = Math.max(prev - 1, 1)
      if (next !== prev) saveProgress(next)
      return next
    })
  }, [saveProgress])

  // Keyboard navigation (moved after goNext/goPrev declarations)
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

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev])

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

  // Tap zones
  const handleTapZone = (zone: 'left' | 'center' | 'right') => {
    if (zone === 'left') goPrev()
    else if (zone === 'right') goNext()
    else setShowMenu(prev => !prev)
  }

  return (
    <div
      style={{ position: 'relative', height: '100%', overflow: 'hidden' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={contentRef}
        className="book-reader reader-scrollbar"
        data-line-width={lineWidth}
        style={{
          columnWidth,
          padding: '1.5rem 1rem',
          fontSize: `${fontSize}px`,
          lineHeight: `${lineHeight}`,
        }}
      >
        <div style={{ position: 'relative' }}>
          <TextSelector containerRef={contentRef} variantId={variantId} />
          {paragraphs.map((p) => (
            <article
              key={p.stableKey || p.id}
              data-paragraph-id={p.id}
              data-stable-key={p.stableKey}
            >
              <p style={{ margin: 0 }}>{p.text}</p>
            </article>
          ))}
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
    </div>
  )
}
