'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Settings, BookOpen, AlignJustify } from 'lucide-react'
import { useReaderStore, type VariantType } from '@/lib/store'
import { applyTheme, themes } from '@/lib/themes'
import FeedReader from '@/components/reader/FeedReader'
import BookReader from '@/components/reader/BookReader'
import { MessageSquare } from 'lucide-react'
import VariantSlider from '@/components/reader/VariantSlider'
import SettingsPanel from '@/components/reader/SettingsPanel'
import TableOfContents from '@/components/reader/TableOfContents'

interface Paragraph {
  id: string
  stableKey: string
  position: number
  text: string
}

interface ChapterData {
  id: string
  title: string
  position: number
  book: {
    id: string
    slug: string
    title: string
    author: { slug: string; name: string }
    chapters: Array<{ id: string; title: string; position: number }>
  }
  variants: Array<{ id: string; variantType: string }>
}

export default function ReaderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const authorSlug = params.authorSlug as string
  const bookSlug = params.bookSlug as string

  const {
    bookId,
    chapterId,
    variantType,
    readingMode,
    theme,
    fontSize,
    lineHeight,
    readerId,
    username,
    replyingTo,
    setBookId,
    setChapterId,
    setVariantType,
    setReadingMode,
    setFontSize,
    setLineHeight,
    setTheme,
    setReaderId,
    setUsername,
    setReplyingTo,
    loadFromStorage,
    saveToStorage,
  } = useReaderStore()

  const [chapterData, setChapterData] = useState<ChapterData | null>(null)
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([])
  const [variantId, setVariantId] = useState<string>('')
  const [availableVariants, setAvailableVariants] = useState<VariantType[]>([])
  const [variantPresets, setVariantPresets] = useState<Record<string, { label: string; emoji: string; description?: string; targetSizePercent?: number | null; position?: number }>>({})
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const commentsSectionRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  // Initialize store from localStorage
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    loadFromStorage()
  }, [loadFromStorage])

  // Sync reader theme CSS vars to document root so portaled components
  // (Sheet, Dialog, Popover, etc.) pick up the correct colors
  useEffect(() => {
    const root = document.documentElement
    const vars = themes[theme].vars

    // Set --r-* vars
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val)
    }

    // Map shadcn CSS vars to reader theme (same as .reader-wrapper does)
    root.style.setProperty('--background', vars['--r-bg'])
    root.style.setProperty('--foreground', vars['--r-text'])
    root.style.setProperty('--card', vars['--r-bg'])
    root.style.setProperty('--card-foreground', vars['--r-text'])
    root.style.setProperty('--popover', vars['--r-bg'])
    root.style.setProperty('--popover-foreground', vars['--r-text'])
    root.style.setProperty('--primary', vars['--r-accent'])
    root.style.setProperty('--primary-foreground', vars['--r-accent-foreground'])
    root.style.setProperty('--secondary', vars['--r-bg-secondary'])
    root.style.setProperty('--secondary-foreground', vars['--r-text'])
    root.style.setProperty('--muted', vars['--r-bg-secondary'])
    root.style.setProperty('--muted-foreground', vars['--r-text-secondary'])
    root.style.setProperty('--accent', vars['--r-bg-secondary'])
    root.style.setProperty('--accent-foreground', vars['--r-text'])
    root.style.setProperty('--border', vars['--r-border'])
    root.style.setProperty('--input', vars['--r-border'])
    root.style.setProperty('--ring', vars['--r-accent'])

    return () => {
      // Clean up: remove all --r-* vars and restore shadcn defaults
      for (const key of Object.keys(vars)) {
        root.style.removeProperty(key)
      }
      const shadcnVars = [
        '--background', '--foreground', '--card', '--card-foreground',
        '--popover', '--popover-foreground', '--primary', '--primary-foreground',
        '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
        '--accent', '--accent-foreground', '--border', '--input', '--ring',
      ]
      for (const v of shadcnVars) {
        root.style.removeProperty(v)
      }
    }
  }, [theme])

  // Fetch chapter data
  const fetchChapter = useCallback(async (cId: string, vType: VariantType) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/chapters/${cId}?variantType=${vType}`)
      if (res.ok) {
        const data = await res.json()
        setChapterData(data.chapter)
        setParagraphs(data.variant?.paragraphs || [])
        setVariantId(data.variant?.id || '')

        // Detect available variants
        const variants = data.chapter?.variants?.map((v: { variantType: string }) => v.variantType) || []
        setAvailableVariants(variants as VariantType[])

        // Store variant preset metadata for dynamic labels
        if (data.variantPresets) {
          setVariantPresets(data.variantPresets)
        }

        // Fetch comment count
        const commentsRes = await fetch(`/api/chapters/${cId}/comments`)
        if (commentsRes.ok) {
          const commentsData = await commentsRes.json()
          setCommentCount(commentsData.comments?.length || 0)
        }

        return data.chapter
      }
    } catch (e) {
      console.error('Failed to fetch chapter:', e)
    } finally {
      setLoading(false)
    }
    return null
  }, [])

  // Restore progress and load initial chapter
  useEffect(() => {
    if (!authorSlug || !bookSlug || !readerId) return

    async function init() {
      try {
        // First fetch book to get first chapter
        const bookRes = await fetch(`/api/books/${bookSlug}?authorSlug=${authorSlug}`)
        if (!bookRes.ok) return
        const bookData = await bookRes.json()
        const book = bookData

        if (!book) return
        setBookId(book.id)

        // Check for saved progress
        let targetChapterId = book.chapters[0]?.id
        let targetVariant = 'original' as VariantType

        try {
          const progressRes = await fetch(`/api/progress?readerId=${readerId}&bookId=${book.id}`)
          if (progressRes.ok) {
            const progressData = await progressRes.json()
            if (progressData.progress) {
              targetChapterId = progressData.progress.chapterId || book.chapters[0]?.id
              targetVariant = progressData.progress.variantType as VariantType || 'original'
              if (progressData.progress.fontSize) setFontSize(progressData.progress.fontSize)
              if (progressData.progress.lineHeight) setLineHeight(progressData.progress.lineHeight)
              if (progressData.progress.theme) setTheme(progressData.progress.theme as typeof theme)
              if (progressData.progress.readingMode) setReadingMode(progressData.progress.readingMode as typeof readingMode)
            }
          }
        } catch {
          // no progress
        }

        // Override with URL param if provided
        const urlChapter = searchParams.get('chapter')
        if (urlChapter) {
          targetChapterId = urlChapter
        }

        setChapterId(targetChapterId!)
        setVariantType(targetVariant)

        if (targetChapterId) {
          await fetchChapter(targetChapterId!, targetVariant)
        }
      } catch (e) {
        console.error('Init failed:', e)
        setLoading(false)
      }
    }

    init()
  }, [authorSlug, bookSlug, readerId])

  // Handle variant change
  const handleVariantChange = useCallback(async (newType: VariantType) => {
    if (!chapterId) return
    await fetchChapter(chapterId, newType)
  }, [chapterId, fetchChapter])

  // Handle chapter change (from Table of Contents)
  const handleChapterChange = useCallback(async (newChapterId: string) => {
    setChapterId(newChapterId)
    await fetchChapter(newChapterId, variantType)
  }, [variantType, fetchChapter, setChapterId])

  // Navigate to next/prev chapter (used by readers at chapter boundaries)
  const goToNextChapter = useCallback(() => {
    if (!chapterData) return
    const chapters = chapterData.book.chapters
    const idx = chapters.findIndex(c => c.id === chapterId)
    if (idx < chapters.length - 1) {
      const nextId = chapters[idx + 1].id
      setChapterId(nextId)
      fetchChapter(nextId, variantType)
    }
  }, [chapterData, chapterId, variantType, setChapterId, fetchChapter])

  const goToPrevChapter = useCallback(() => {
    if (!chapterData) return
    const chapters = chapterData.book.chapters
    const idx = chapters.findIndex(c => c.id === chapterId)
    if (idx > 0) {
      const prevId = chapters[idx - 1].id
      setChapterId(prevId)
      fetchChapter(prevId, variantType)
    }
  }, [chapterData, chapterId, variantType, setChapterId, fetchChapter])

  // Send comment
  const handleSendComment = useCallback(async (body: string) => {
    if (!chapterId || !bookId || !readerId || !username) return

    try {
      const quotes = replyingTo
        ? [{
            variantType: replyingTo.variantType,
            paragraphId: replyingTo.paragraphId,
            selectedText: replyingTo.text,
          }]
        : undefined

      const res = await fetch(`/api/chapters/${chapterId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerId,
          username,
          body,
          bookId,
          quotes,
        }),
      })

      if (res.ok) {
        setCommentCount(prev => prev + 1)
        setReplyingTo(null)
      }
    } catch (e) {
      console.error('Failed to send comment:', e)
    }
  }, [chapterId, bookId, readerId, username, replyingTo, setReplyingTo])

  // Theme CSS variables
  const themeVars = applyTheme(theme)

  // Derived values for chapter navigation
  const chapters = chapterData?.book.chapters || []
  const currentChapterIndex = chapters.findIndex(c => c.id === chapterId)
  const hasNextChapter = currentChapterIndex < chapters.length - 1
  const hasPrevChapter = currentChapterIndex > 0
  const nextChapter = hasNextChapter ? chapters[currentChapterIndex + 1] : null
  const prevChapter = hasPrevChapter ? chapters[currentChapterIndex - 1] : null

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="p-4 border-b">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-4 w-3/4 mb-4" />
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    )
  }

  if (!chapterData) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Не удалось загрузить главу</p>
          <Link href={`/${authorSlug}/${bookSlug}`} className="text-sm text-muted-foreground hover:underline">
            &larr; Вернуться к книге
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="reader-wrapper h-screen flex flex-col"
      data-reader-theme={theme}
      style={themeVars as React.CSSProperties}
    >
      {/* Top bar — minimal: back, title, TOC, settings, comments */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.5rem 0.5rem 0.5rem 0.25rem',
          borderBottom: '1px solid var(--r-border)',
          backgroundColor: 'var(--r-bg)',
          flexShrink: 0,
          zIndex: 30,
        }}
      >
        {/* Back */}
        <Link
          href={`/${authorSlug}/${bookSlug}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            minWidth: '44px',
            minHeight: '44px',
            color: 'var(--r-text)',
          }}
        >
          <ArrowLeft size={20} />
        </Link>

        {/* Book title (truncated) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--r-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={chapterData.book.title}
          >
            {chapterData.book.title}
          </div>
          <div
            style={{
              fontSize: '0.6875rem',
              color: 'var(--r-text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {chapterData.title}
          </div>
        </div>

        {/* Reading mode toggle */}
        <button
          onClick={() => setReadingMode(readingMode === 'feed' ? 'book' : 'feed')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            minWidth: '44px',
            minHeight: '44px',
            color: 'var(--r-text)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          title={readingMode === 'feed' ? 'Режим книги' : 'Режим ленты'}
        >
          {readingMode === 'feed' ? <BookOpen size={20} /> : <AlignJustify size={20} />}
        </button>

        {/* Table of Contents */}
        <TableOfContents
          chapters={chapters}
          currentChapterId={chapterId || ''}
          onChapterChange={handleChapterChange}
        />

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            minWidth: '44px',
            minHeight: '44px',
            color: 'var(--r-text)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          title="Настройки"
        >
          <Settings size={20} />
        </button>

        {/* Comments — scroll to bottom */}
        <button
          onClick={() => {
            if (readingMode === 'feed') {
              // Feed: scroll to comments section at bottom
              commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
            } else {
              // Book: show comments page
              // We'll use a custom event since BookReader manages its own state
              window.dispatchEvent(new CustomEvent('bookstream:show-comments'))
            }
          }}
          style={{
            position: 'relative',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--r-text)',
            padding: '0.5rem',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Комментарии"
        >
          <MessageSquare size={20} />
          {commentCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '0.125rem',
                right: '0.125rem',
                backgroundColor: 'var(--r-accent)',
                color: 'var(--r-accent-foreground)',
                fontSize: '0.625rem',
                fontWeight: 700,
                width: '1.125rem',
                height: '1.125rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {commentCount > 99 ? '99+' : commentCount}
            </span>
          )}
        </button>
      </header>

      {/* Variant slider */}
      {availableVariants.length > 1 && (
        <div
          style={{
            padding: '0.5rem 1rem',
            borderBottom: '1px solid var(--r-border)',
            flexShrink: 0,
          }}
        >
          <VariantSlider
            onVariantChange={handleVariantChange}
            availableVariants={availableVariants}
            variantPresets={variantPresets}
          />
        </div>
      )}

      {/* Reader content */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {readingMode === 'feed' ? (
          <FeedReader
            key={`${chapterId}-${variantType}`}
            paragraphs={paragraphs}
            variantId={variantId}
            nextChapter={nextChapter}
            onNextChapter={goToNextChapter}
            commentsSectionRef={commentsSectionRef}
            onSendComment={handleSendComment}
            commentCount={commentCount}
          />
        ) : (
          <BookReader
            key={`${chapterId}-${variantType}`}
            paragraphs={paragraphs}
            variantId={variantId}
            hasNextChapter={hasNextChapter}
            hasPrevChapter={hasPrevChapter}
            onNextChapter={goToNextChapter}
            onPrevChapter={goToPrevChapter}
            chapterTitle={chapterData.title}
            onSendComment={handleSendComment}
            commentCount={commentCount}
          />
        )}
      </main>

      {/* Settings panel */}
      <SettingsPanel
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  )
}
