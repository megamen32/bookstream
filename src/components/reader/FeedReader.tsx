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
}

export default function FeedReader({
  paragraphs,
  variantId,
  nextChapter,
  onNextChapter,
  commentsSectionRef,
  onSendComment,
  commentCount,
}: FeedReaderProps) {
  const { fontSize, lineHeight, lineWidth, theme, bookId, chapterId, readerId, readingMode } = useReaderStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showNextLoader, setShowNextLoader] = useState(false)

  // Expose scroll-to-comments function via ref (parent can call it)
  const scrollToComments = useCallback(() => {
    if (commentsSectionRef?.current) {
      commentsSectionRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [commentsSectionRef])

  // Expose via data attribute so parent can trigger scroll
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      (el as unknown as Record<string, unknown>)._scrollToComments = scrollToComments
    }
  }, [scrollToComments])

  // Restore scroll position
  useEffect(() => {
    if (restoredRef.current || !scrollRef.current) return
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

    // Show loader when near bottom and there's a next chapter
    if (nextChapter) {
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distanceToBottom < 200) {
        setShowNextLoader(true)
      } else {
        setShowNextLoader(false)
      }
    }
  }, [saveProgress, nextChapter])

  const handleLoadNextChapter = useCallback(() => {
    if (showNextLoader && nextChapter) {
      onNextChapter()
    }
  }, [showNextLoader, nextChapter, onNextChapter])

  return (
    <div
      ref={scrollRef}
      className="reader-scrollbar"
      onScroll={handleScroll}
      style={{ overflowY: 'auto', height: '100%', padding: '1.5rem 1rem' }}
    >
      <div style={{ position: 'relative' }}>
        <TextSelector containerRef={scrollRef} variantId={variantId} />
        <div
          className="reader-content"
          data-line-width={lineWidth}
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: `${lineHeight}`,
            maxWidth: lineWidth === 'narrow' ? '36rem' : lineWidth === 'medium' ? '48rem' : '64rem',
            margin: '0 auto',
          }}
        >
          {paragraphs.map((p) => (
            <article
              key={p.stableKey || p.id}
              data-paragraph-id={p.id}
              data-stable-key={p.stableKey}
              style={{ marginBottom: '1em' }}
            >
              <p style={{ margin: 0 }}>{p.text}</p>
            </article>
          ))}
        </div>

        {/* Telegram-style chapter separator at the end */}
        {nextChapter && (
          <div style={{ maxWidth: lineWidth === 'narrow' ? '36rem' : lineWidth === 'medium' ? '48rem' : '64rem', margin: '1.5rem auto 2rem' }}>
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
          <div style={{ textAlign: 'center', padding: '1rem 1rem 0', maxWidth: lineWidth === 'narrow' ? '36rem' : lineWidth === 'medium' ? '48rem' : '64rem', margin: '0 auto' }}>
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
        <div style={{ maxWidth: lineWidth === 'narrow' ? '36rem' : lineWidth === 'medium' ? '48rem' : '64rem', margin: '1.5rem auto 0' }}>
          <CommentsSection
            chapterId={chapterId || ''}
            onSendComment={onSendComment}
            sectionRef={commentsSectionRef}
          />
        </div>

        {/* Bottom spacer so last comment is not cut off */}
        <div style={{ height: '2rem' }} />
      </div>
    </div>
  )
}
