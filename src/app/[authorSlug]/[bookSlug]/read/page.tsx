'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Settings, BookOpen, AlignJustify, Search, Bookmark, BookmarkCheck, UserRound } from 'lucide-react'
import { useReaderStore, type VariantType } from '@/lib/store'
import { applyTheme, themes } from '@/lib/themes'
import FeedReader from '@/components/reader/FeedReader'
import BookReader from '@/components/reader/BookReader'
import { MessageSquare } from 'lucide-react'
import VariantSlider from '@/components/reader/VariantSlider'
import SettingsPanel from '@/components/reader/SettingsPanel'
import TableOfContents from '@/components/reader/TableOfContents'
import SearchPanel from '@/components/reader/SearchPanel'
import CommentsSection from '@/components/reader/CommentsSection'
import UserActivityPanel from '@/components/reader/UserActivityPanel'

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

const BOOKMARKS_KEY = 'bookstream-bookmarks'

function loadBookmarks(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '{}')
  } catch { return {} }
}

function saveBookmarks(bm: Record<string, string>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bm))
}

export default function ReaderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const authorSlug = params.authorSlug as string
  const bookSlug = params.bookSlug as string
  const searchParamsString = searchParams.toString()

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
    setReplyingTo,
    loadFromStorage,
  } = useReaderStore()

  const [chapterData, setChapterData] = useState<ChapterData | null>(null)
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([])
  const [variantId, setVariantId] = useState<string>('')
  const [availableVariants, setAvailableVariants] = useState<string[]>([])
  const [variantPresets, setVariantPresets] = useState<Record<string, { id: string; label: string; emoji: string; description?: string; targetSizePercent?: number | null; position?: number }>>({})
  const [loading, setLoading] = useState(true)
  const [generatingVariant, setGeneratingVariant] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showDesktopComments, setShowDesktopComments] = useState(false)
  const [showActivityPanel, setShowActivityPanel] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [bookmarkedKey, setBookmarkedKey] = useState<string | null>(null)
  const [quoteTargetParagraphId, setQuoteTargetParagraphId] = useState<string | null>(null)
  const [quoteTargetParagraphEndId, setQuoteTargetParagraphEndId] = useState<string | null>(null)
  const commentsSectionRef = useRef<HTMLDivElement>(null)
  const searchContentRef = useRef<HTMLDivElement | null>(null)
  const initialized = useRef(false)
  const setSearchContentNode = useCallback((node: HTMLDivElement | null) => {
    searchContentRef.current = node
  }, [])

  // Initialize store from localStorage
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    loadFromStorage()
  }, [loadFromStorage])

  // Load bookmark for current chapter
  useEffect(() => {
    if (!chapterId) return
    const frameId = window.requestAnimationFrame(() => {
      const bms = loadBookmarks()
      setBookmarkedKey(bms[chapterId] || null)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [chapterId])

  // Ctrl+F handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Sync reader theme CSS vars to document root
  useEffect(() => {
    const root = document.documentElement
    const vars = themes[theme].vars
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val)
    }
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
        const variants = data.chapter?.variants?.map((v: { variantType: string }) => v.variantType) || []
        setAvailableVariants(variants as VariantType[])
        if (data.variantPresets) {
          setVariantPresets(data.variantPresets)
        }
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
        const bookRes = await fetch(`/api/books/${bookSlug}?authorSlug=${authorSlug}`)
        if (!bookRes.ok) return
        const bookData = await bookRes.json()
        const book = bookData
        if (!book) return
        setBookId(book.id)

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
        } catch { /* no progress */ }

        const queryParams = new URLSearchParams(searchParamsString)

        const urlChapter = queryParams.get('chapter')
        if (urlChapter) {
          targetChapterId = urlChapter
        }
        const urlVariant = queryParams.get('variant')
        if (urlVariant) {
          targetVariant = urlVariant
        }
        const urlParagraph = queryParams.get('paragraph')
        const urlParagraphEnd = queryParams.get('paragraphEnd')
        setQuoteTargetParagraphId(urlParagraph)
        setQuoteTargetParagraphEndId(urlParagraphEnd)

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
  }, [authorSlug, bookSlug, readerId, searchParamsString])

  const handleVariantChange = useCallback(async (newType: VariantType) => {
    if (!chapterId) return
    setQuoteTargetParagraphId(null)
    setQuoteTargetParagraphEndId(null)

    // Check if variant already exists in DB
    const exists = availableVariants.includes(newType)

    if (!exists) {
      // Need to generate via AI first
      const preset = variantPresets[newType]
      if (!preset?.id) return

      setGeneratingVariant(newType)
      try {
        const res = await fetch(`/api/chapters/${chapterId}/summarize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetIds: [preset.id] }),
        })
        if (res.ok) {
          // Now fetch the newly generated variant
          await fetchChapter(chapterId, newType)
        }
      } catch (e) {
        console.error('Failed to generate variant:', e)
      } finally {
        setGeneratingVariant(null)
      }
    } else {
      await fetchChapter(chapterId, newType)
    }
  }, [chapterId, availableVariants, variantPresets, fetchChapter])

  const handleChapterChange = useCallback(async (newChapterId: string) => {
    setQuoteTargetParagraphId(null)
    setQuoteTargetParagraphEndId(null)
    setChapterId(newChapterId)
    await fetchChapter(newChapterId, variantType)
  }, [variantType, fetchChapter, setChapterId])

  const goToNextChapter = useCallback(() => {
    if (!chapterData) return
    setQuoteTargetParagraphId(null)
    setQuoteTargetParagraphEndId(null)
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
    setQuoteTargetParagraphId(null)
    setQuoteTargetParagraphEndId(null)
    const chapters = chapterData.book.chapters
    const idx = chapters.findIndex(c => c.id === chapterId)
    if (idx > 0) {
      const prevId = chapters[idx - 1].id
      setChapterId(prevId)
      fetchChapter(prevId, variantType)
    }
  }, [chapterData, chapterId, variantType, setChapterId, fetchChapter])

  const handleSendComment = useCallback(async (body: string) => {
    if (!chapterId || !bookId || !readerId || !username) return
    try {
      const quotes = replyingTo
        ? [{
            variantType: replyingTo.variantType,
            paragraphId: replyingTo.paragraphId,
            endParagraphId: replyingTo.endParagraphId,
            selectedText: replyingTo.selectedText || replyingTo.text,
            startOffset: replyingTo.startOffset || 0,
            endOffset: replyingTo.endOffset || 0,
          }]
        : undefined
      const res = await fetch(`/api/chapters/${chapterId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readerId, username, body, bookId, quotes }),
      })
      if (res.ok) {
        setCommentCount(prev => prev + 1)
        setReplyingTo(null)
      }
    } catch (e) {
      console.error('Failed to send comment:', e)
    }
  }, [chapterId, bookId, readerId, username, replyingTo, setReplyingTo])

  // Bookmark toggle
  const handleToggleBookmark = useCallback((stableKey: string) => {
    if (!chapterId) return
    const bms = loadBookmarks()
    if (bms[chapterId] === stableKey) {
      delete bms[chapterId]
      setBookmarkedKey(null)
    } else {
      bms[chapterId] = stableKey
      setBookmarkedKey(stableKey)
    }
    saveBookmarks(bms)
  }, [chapterId])

  // Scroll to bookmarked paragraph
  const scrollToBookmark = useCallback(() => {
    if (!bookmarkedKey) return
    const el = document.querySelector(`[data-stable-key="${bookmarkedKey}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [bookmarkedKey])

  const themeVars = applyTheme(theme)
  const chapters = chapterData?.book.chapters || []
  const currentChapterIndex = chapters.findIndex(c => c.id === chapterId)
  const hasNextChapter = currentChapterIndex < chapters.length - 1
  const hasPrevChapter = currentChapterIndex > 0
  const nextChapter = hasNextChapter ? chapters[currentChapterIndex + 1] : null
  const prevChapter = hasPrevChapter ? chapters[currentChapterIndex - 1] : null
  const progressPercent = Math.round(scrollProgress * 100)

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
      {/* Search panel */}
      <SearchPanel
        open={showSearch}
        onClose={() => setShowSearch(false)}
        contentRef={searchContentRef}
      />

      {/* Activity panel */}
      <UserActivityPanel
        open={showActivityPanel}
        onOpenChange={setShowActivityPanel}
        bookId={bookId || ''}
        bookTitle={chapterData?.book.title}
        authorSlug={authorSlug}
        bookSlug={bookSlug}
      />

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

        {/* Book title */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            {/* Progress indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
              <div style={{
                width: '2rem',
                height: '3px',
                borderRadius: '9999px',
                backgroundColor: 'var(--r-border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--r-accent)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{ fontSize: '0.625rem', color: 'var(--r-text-secondary)', minWidth: '1.75rem' }}>
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Search button */}
        <button
          onClick={() => setShowSearch(true)}
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
          title="Поиск (Ctrl+F)"
        >
          <Search size={20} />
        </button>

        {/* Bookmark button */}
        <button
          onClick={bookmarkedKey ? scrollToBookmark : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            minWidth: '44px',
            minHeight: '44px',
            color: bookmarkedKey ? 'var(--r-accent)' : 'var(--r-text)',
            background: 'none',
            border: 'none',
            cursor: bookmarkedKey ? 'pointer' : 'default',
          }}
          title={bookmarkedKey ? 'Перейти к закладке' : 'Нет закладки'}
        >
          {bookmarkedKey ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
        </button>

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

        {/* Desktop comments toggle */}
        <button
          onClick={() => setShowDesktopComments(!showDesktopComments)}
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            minWidth: '44px',
            minHeight: '44px',
            color: showDesktopComments ? 'var(--r-accent)' : 'var(--r-text)',
            background: showDesktopComments ? 'var(--r-bg-secondary)' : 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '0.375rem',
          }}
          className="desktop-comments-toggle"
          title="Панель комментариев"
        >
          <MessageSquare size={20} />
          {commentCount > 0 && (
            <span style={{
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
            }}>
              {commentCount > 99 ? '99+' : commentCount}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => setShowActivityPanel(true)}
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
          title="Моя активность"
        >
          <UserRound size={20} />
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
      </header>

      {/* Variant slider — show if there are presets (even ungenerated) or multiple variants */}
      {(Object.keys(variantPresets).length > 0 || availableVariants.length > 1) && (
        <div
          style={{
            padding: '0.5rem 1rem',
            borderBottom: '1px solid var(--r-border)',
            flexShrink: 0,
          }}
        >
          <VariantSlider
            onVariantChange={handleVariantChange}
            generatedVariants={availableVariants}
            variantPresets={variantPresets}
            generatingVariant={generatingVariant}
          />
        </div>
      )}

      {/* Reader content + optional desktop comments sidebar */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
        {/* Main content area */}
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {readingMode === 'feed' ? (
            <FeedReader
              key={`${chapterId}-${variantType}`}
              paragraphs={paragraphs}
              variantId={variantId}
              chapterTitle={chapterData.title}
              nextChapter={nextChapter}
              onNextChapter={goToNextChapter}
              commentsSectionRef={commentsSectionRef}
              onSendComment={handleSendComment}
              commentCount={commentCount}
              setContentNode={setSearchContentNode}
              onScrollProgress={setScrollProgress}
              bookmarkedKey={bookmarkedKey}
              onToggleBookmark={handleToggleBookmark}
              authorSlug={authorSlug}
              bookSlug={bookSlug}
              highlightParagraphId={quoteTargetParagraphId}
              highlightParagraphEndId={quoteTargetParagraphEndId}
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
              onProgress={setScrollProgress}
              bookmarkedKey={bookmarkedKey}
              onToggleBookmark={handleToggleBookmark}
              searchOpen={showSearch}
              setContentNode={setSearchContentNode}
              authorSlug={authorSlug}
              bookSlug={bookSlug}
              highlightParagraphId={quoteTargetParagraphId}
              highlightParagraphEndId={quoteTargetParagraphEndId}
            />
          )}
        </main>

        {/* Desktop comments sidebar — hidden on mobile, toggleable on desktop */}
        {showDesktopComments && readingMode === 'feed' && (
          <aside
            className="slide-up-enter desktop-sidebar-comments"
            style={{
              width: '320px',
              flexShrink: 0,
              borderLeft: '1px solid var(--r-border)',
              backgroundColor: 'var(--r-bg)',
              overflowY: 'auto',
              padding: '1rem',
              display: 'none', // shown via CSS media query
            }}
          >
            <CommentsSection
              chapterId={chapterId || ''}
              onSendComment={handleSendComment}
              authorSlug={authorSlug}
              bookSlug={bookSlug}
            />
          </aside>
        )}
      </div>

      {/* Settings panel */}
      <SettingsPanel
        open={showSettings}
        onOpenChange={setShowSettings}
      />

      {/* CSS for desktop-only elements */}
      <style>{`
        @media (min-width: 1024px) {
          .desktop-comments-toggle {
            display: flex !important;
            position: relative;
          }
          .desktop-sidebar-comments {
            display: block !important;
          }
        }
        /* Show bookmark buttons on paragraph hover */
        .group:hover .bookmark-btn {
          opacity: 1 !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
