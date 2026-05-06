'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useReaderStore } from '@/lib/store'
import TextSelector from './TextSelector'

interface FeedReaderProps {
  paragraphs: Array<{
    id: string
    stableKey: string
    position: number
    text: string
  }>
  variantId: string
}

export default function FeedReader({ paragraphs, variantId }: FeedReaderProps) {
  const { fontSize, lineHeight, lineWidth, theme, bookId, chapterId, readerId, readingMode } = useReaderStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore scroll position
  useEffect(() => {
    if (restoredRef.current || !scrollRef.current) return

    const savedScroll = localStorage.getItem(`bookstream-scroll-${chapterId}`)
    if (savedScroll) {
      const pos = parseFloat(savedScroll)
      scrollRef.current.scrollTop = pos
    }
    restoredRef.current = true
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
  }, [saveProgress])

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
      </div>
    </div>
  )
}
