'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Settings, List, BookOpen, AlignJustify } from 'lucide-react'
import { useReaderStore, type VariantType } from '@/lib/store'
import { applyTheme } from '@/lib/themes'
import FeedReader from '@/components/reader/FeedReader'
import BookReader from '@/components/reader/BookReader'
import CommentComposer from '@/components/reader/CommentComposer'
import CommentList from '@/components/reader/CommentList'
import VariantSlider from '@/components/reader/VariantSlider'
import SettingsPanel from '@/components/reader/SettingsPanel'
import ChapterNavigation from '@/components/reader/ChapterNavigation'

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
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const initialized = useRef(false)

  // Initialize store from localStorage
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    loadFromStorage()
  }, [loadFromStorage])

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

  // Handle chapter change
  const handleChapterChange = useCallback(async (newChapterId: string) => {
    if (!chapterId) return
    setChapterId(newChapterId)
    await fetchChapter(newChapterId, variantType)
  }, [chapterId, variantType, fetchChapter, setChapterId])

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
            ← Вернуться к книге
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
      {/* Top bar */}
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

        {/* Chapter navigation */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {chapterData.book.chapters.length > 0 && (
            <ChapterNavigation
              chapters={chapterData.book.chapters}
              currentChapterId={chapterId || ''}
              onChapterChange={handleChapterChange}
              theme={theme}
            />
          )}
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

        {/* Comments */}
        <CommentList
          chapterId={chapterId || ''}
          open={showComments}
          onOpenChange={setShowComments}
          commentCount={commentCount}
        />
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
          />
        ) : (
          <BookReader
            key={`${chapterId}-${variantType}`}
            paragraphs={paragraphs}
            variantId={variantId}
          />
        )}
      </main>

      {/* Comment composer */}
      <CommentComposer onSend={handleSendComment} />

      {/* Settings panel */}
      <SettingsPanel
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  )
}
