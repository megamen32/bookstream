'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Settings,
  BookOpen,
  AlignJustify,
  Search,
  Bookmark,
  BookmarkCheck,
  UserRound,
  MessageSquare,
} from 'lucide-react'
import { useReaderStore, type VariantType, type ReadingMode } from '@/lib/store'
import { applyTheme } from '@/lib/themes'
import FeedReader from '@/components/reader/FeedReader'
import BookReader from '@/components/reader/BookReader'
import VariantSlider from '@/components/reader/VariantSlider'
import SettingsPanel from '@/components/reader/SettingsPanel'
import TableOfContents from '@/components/reader/TableOfContents'
import SearchPanel from '@/components/reader/SearchPanel'
import CommentsSection from '@/components/reader/CommentsSection'
import type { ReaderComment } from '@/components/reader/comment-types'
import type { FeedSectionData, ReaderChapterListItem } from '@/components/reader/feed-types'

interface BookData {
  id: string
  slug: string
  title: string
  readingModeDefault: ReadingMode
  author: { slug: string; name: string }
  chapters: ReaderChapterListItem[]
}

interface FeedResponse {
  sections: FeedSectionData[]
  variantPresets?: Record<string, VariantPresetRecord>
  hasPrev: boolean
  hasNext: boolean
}

interface VariantPresetRecord {
  id: string
  label: string
  emoji: string
  description?: string
  targetSizePercent?: number | null
  position?: number
}

interface RestoreRequest {
  chapterId: string
  scrollPercent: number
  token: number
}

const BOOKMARKS_KEY = 'bookstream-bookmarks'

function loadBookmarks(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveBookmarks(bookmarks: Record<string, string>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks))
}

function countVisibleComments(
  comments: ReaderComment[],
  readerId: string,
  showCommunityAnnotations: boolean,
): number {
  if (showCommunityAnnotations) {
    return comments.length
  }

  return comments.filter((comment) => comment.readerId === readerId).length
}

function mergeSections(current: FeedSectionData[], incoming: FeedSectionData[]): FeedSectionData[] {
  const merged = new Map<string, FeedSectionData>()
  for (const section of current) {
    merged.set(section.chapter.id, section)
  }
  for (const section of incoming) {
    merged.set(section.chapter.id, section)
  }
  return Array.from(merged.values()).sort((a, b) => a.chapter.position - b.chapter.position)
}

function prependUniqueComment(comments: ReaderComment[], comment: ReaderComment, limit: number): ReaderComment[] {
  const next = [comment, ...comments.filter((entry) => entry.id !== comment.id)]
  return next.slice(0, limit)
}

export default function ReaderPage() {
  const params = useParams()
  const authorSlug = params.authorSlug as string
  const bookSlug = params.bookSlug as string

  const {
    bookId,
    chapterId,
    variantType,
    readingMode,
    theme,
    accentTheme,
    readerId,
    username,
    replyingTo,
    showCommunityAnnotations,
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

  const [bookData, setBookData] = useState<BookData | null>(null)
  const [bookModeSection, setBookModeSection] = useState<FeedSectionData | null>(null)
  const [feedSections, setFeedSections] = useState<FeedSectionData[]>([])
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [availableVariants, setAvailableVariants] = useState<string[]>([])
  const [variantPresets, setVariantPresets] = useState<Record<string, VariantPresetRecord>>({})
  const [loading, setLoading] = useState(true)
  const [feedLoadingPrev, setFeedLoadingPrev] = useState(false)
  const [feedLoadingNext, setFeedLoadingNext] = useState(false)
  const [feedHasMorePrev, setFeedHasMorePrev] = useState(false)
  const [feedHasMoreNext, setFeedHasMoreNext] = useState(false)
  const [generatingVariant, setGeneratingVariant] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showDesktopComments, setShowDesktopComments] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [bookmarksByChapter, setBookmarksByChapter] = useState<Record<string, string>>({})
  const [quoteTargetParagraphId, setQuoteTargetParagraphId] = useState<string | null>(null)
  const [quoteTargetParagraphEndId, setQuoteTargetParagraphEndId] = useState<string | null>(null)
  const [restoreRequest, setRestoreRequest] = useState<RestoreRequest | null>(null)
  const [scrollToChapterId, setScrollToChapterId] = useState<string | null>(null)
  const commentsSectionRef = useRef<HTMLDivElement>(null)
  const searchContentRef = useRef<HTMLDivElement | null>(null)
  const initialized = useRef(false)
  const hasResolvedInitialLocation = useRef(false)
  const restoreTokenRef = useRef(0)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeChapterRef = useRef<string | null>(null)

  const setSearchContentNode = useCallback((node: HTMLDivElement | null) => {
    searchContentRef.current = node
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    loadFromStorage()
    setBookmarksByChapter(loadBookmarks())
  }, [loadFromStorage])

  useEffect(() => {
    activeChapterRef.current = activeChapterId
  }, [activeChapterId])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault()
        setShowSearch(true)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const vars = applyTheme(theme, accentTheme)
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, String(value))
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
      for (const variable of shadcnVars) {
        root.style.removeProperty(variable)
      }
    }
  }, [theme, accentTheme])

  const loadChapterCommentCount = useCallback(async (targetChapterId: string): Promise<void> => {
    if (!targetChapterId || !readerId) {
      setCommentCount(0)
      return
    }

    try {
      const commentsRes = await fetch(`/api/chapters/${targetChapterId}/comments`)
      if (!commentsRes.ok) return

      const commentsData = await commentsRes.json() as { comments?: ReaderComment[] }
      const loadedComments = Array.isArray(commentsData.comments) ? commentsData.comments : []
      setCommentCount(countVisibleComments(loadedComments, readerId, showCommunityAnnotations))
    } catch (error) {
      console.error('Failed to fetch chapter comments:', error)
    }
  }, [readerId, showCommunityAnnotations])

  const fetchFeedWindow = useCallback(async (
    targetBookId: string,
    anchorId: string,
    requestedVariant: VariantType,
    before: number,
    after: number,
  ): Promise<FeedResponse | null> => {
    const params = new URLSearchParams({
      anchorChapterId: anchorId,
      variantType: requestedVariant,
      before: String(before),
      after: String(after),
      previewLimit: '5',
    })
    const response = await fetch(`/api/books/${targetBookId}/feed?${params.toString()}`)
    if (!response.ok) {
      return null
    }
    return await response.json() as FeedResponse
  }, [])

  const fetchSingleChapter = useCallback(async (
    targetChapterId: string,
    requestedVariant: VariantType,
  ): Promise<FeedSectionData | null> => {
    const requestChapter = async (nextVariant: VariantType): Promise<FeedSectionData | null> => {
      const response = await fetch(`/api/chapters/${targetChapterId}?variantType=${nextVariant}`)
      if (response.ok) {
        const data = await response.json() as {
          chapter: BookData['chapters'][number] & {
            book: BookData
          }
          variant: FeedSectionData['variant']
          variantPresets?: Record<string, VariantPresetRecord>
          prevChapter?: { id: string } | null
          nextChapter?: { id: string } | null
        }

        if (data.variantPresets) {
          setVariantPresets(data.variantPresets)
        }

        return {
          chapter: {
            id: data.chapter.id,
            title: data.chapter.title,
            position: data.chapter.position,
            level: data.chapter.level,
            variants: data.chapter.variants.map((variant) => ({
              id: variant.id,
              variantType: variant.variantType,
            })),
          },
          variant: data.variant,
          commentsPreview: [],
          commentCount: 0,
          prevChapterId: data.prevChapter?.id || null,
          nextChapterId: data.nextChapter?.id || null,
        }
      }

      if (response.status === 404 && nextVariant !== 'original') {
        setVariantType('original')
        return requestChapter('original')
      }

      return null
    }

    return requestChapter(requestedVariant)
  }, [setVariantType])

  const applyActiveVariantOptions = useCallback((sections: FeedSectionData[], nextActiveChapterId: string | null): void => {
    if (!nextActiveChapterId) {
      setAvailableVariants([])
      return
    }

    const activeSection = sections.find((section) => section.chapter.id === nextActiveChapterId)
    if (!activeSection) {
      setAvailableVariants([])
      return
    }

    setAvailableVariants(activeSection.chapter.variants.map((variant) => variant.variantType))
  }, [])

  const replaceFeedSections = useCallback(async (
    anchorId: string,
    requestedVariant: VariantType,
    before: number,
    after: number,
    scrollPercent: number,
    shouldScrollToChapter: boolean,
  ): Promise<void> => {
    if (!bookId) return

    const data = await fetchFeedWindow(bookId, anchorId, requestedVariant, before, after)
    if (!data) return

    setFeedSections(data.sections)
    setFeedHasMorePrev(data.hasPrev)
    setFeedHasMoreNext(data.hasNext)
    if (data.variantPresets) {
      setVariantPresets(data.variantPresets)
    }
    applyActiveVariantOptions(data.sections, anchorId)

    restoreTokenRef.current += 1
    setRestoreRequest({
      chapterId: anchorId,
      scrollPercent,
      token: restoreTokenRef.current,
    })

    if (shouldScrollToChapter) {
      setScrollToChapterId(anchorId)
    }
  }, [applyActiveVariantOptions, bookId, fetchFeedWindow])

  const saveReadingProgress = useCallback((targetChapterId: string, progress: number): void => {
    if (!bookId || !readerId) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readerId,
            bookId,
            chapterId: targetChapterId,
            variantType: useReaderStore.getState().variantType,
            scrollPercent: progress,
            fontSize: useReaderStore.getState().fontSize,
            lineHeight: useReaderStore.getState().lineHeight,
            theme: useReaderStore.getState().theme,
            readingMode: useReaderStore.getState().readingMode,
          }),
        })
      } catch (error) {
        console.error('Failed to save progress:', error)
      }
    }, 1200)
  }, [bookId, readerId])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!authorSlug || !bookSlug || !readerId) return

    async function init(): Promise<void> {
      hasResolvedInitialLocation.current = false
      setLoading(true)

      try {
        const bookRes = await fetch(`/api/books/${bookSlug}?authorSlug=${authorSlug}`)
        if (!bookRes.ok) {
          setLoading(false)
          hasResolvedInitialLocation.current = true
          return
        }

        const book = await bookRes.json() as BookData
        setBookData(book)
        setBookId(book.id)

        let targetChapterId = book.chapters[0]?.id || null
        let targetVariant = 'original' as VariantType
        let targetMode = book.readingModeDefault || 'feed'
        let restoreScrollPercent = 0

        try {
          const progressRes = await fetch(`/api/progress?readerId=${readerId}&bookId=${book.id}`)
          if (progressRes.ok) {
            const progressData = await progressRes.json() as {
              chapterId?: string
              variantType?: string
              fontSize?: number
              lineHeight?: number
              theme?: string
              readingMode?: ReadingMode
              scrollPercent?: number
            } | null
            if (progressData) {
              targetChapterId = progressData.chapterId || targetChapterId
              targetVariant = progressData.variantType || targetVariant
              targetMode = progressData.readingMode || targetMode
              restoreScrollPercent = progressData.scrollPercent ?? 0
              if (progressData.fontSize) setFontSize(progressData.fontSize)
              if (progressData.lineHeight) setLineHeight(progressData.lineHeight)
              if (progressData.theme) setTheme(progressData.theme as typeof theme)
            }
          }
        } catch {
          // Ignore missing progress during boot.
        }

        const queryParams = new URLSearchParams(window.location.search)
        const urlChapter = queryParams.get('chapter')
        const urlVariant = queryParams.get('variant')
        const urlParagraph = queryParams.get('paragraph')
        const urlParagraphEnd = queryParams.get('paragraphEnd')

        if (urlChapter && book.chapters.some((chapter) => chapter.id === urlChapter)) {
          targetChapterId = urlChapter
          restoreScrollPercent = 0
        }
        if (urlVariant) {
          targetVariant = urlVariant as VariantType
        }

        setQuoteTargetParagraphId(urlParagraph)
        setQuoteTargetParagraphEndId(urlParagraphEnd)

        if (!targetChapterId) {
          setLoading(false)
          hasResolvedInitialLocation.current = true
          return
        }

        setReadingMode(targetMode)
        setVariantType(targetVariant)
        setActiveChapterId(targetChapterId)
        setChapterId(targetChapterId)
        applyActiveVariantOptions(
          book.chapters.map((chapter) => ({
            chapter,
            variant: { id: '', variantType: targetVariant, paragraphs: [] },
            commentsPreview: [],
            commentCount: 0,
            prevChapterId: null,
            nextChapterId: null,
          })),
          targetChapterId,
        )

        if (targetMode === 'feed') {
          const data = await fetchFeedWindow(book.id, targetChapterId, targetVariant, 1, 1)
          if (data) {
            setFeedSections(data.sections)
            setFeedHasMorePrev(data.hasPrev)
            setFeedHasMoreNext(data.hasNext)
            if (data.variantPresets) {
              setVariantPresets(data.variantPresets)
            }
            applyActiveVariantOptions(data.sections, targetChapterId)
            restoreTokenRef.current += 1
            setRestoreRequest({
              chapterId: targetChapterId,
              scrollPercent: urlParagraph ? 0 : restoreScrollPercent,
              token: restoreTokenRef.current,
            })
          }
        } else {
          const section = await fetchSingleChapter(targetChapterId, targetVariant)
          if (section) {
            setBookModeSection(section)
            setAvailableVariants(section.chapter.variants.map((variant) => variant.variantType))
          }
        }

        void loadChapterCommentCount(targetChapterId)
      } catch (error) {
        console.error('Init failed:', error)
      } finally {
        setLoading(false)
        hasResolvedInitialLocation.current = true
      }
    }

    void init()
  }, [
    applyActiveVariantOptions,
    authorSlug,
    bookSlug,
    fetchFeedWindow,
    fetchSingleChapter,
    loadChapterCommentCount,
    readerId,
    setBookId,
    setChapterId,
    setFontSize,
    setLineHeight,
    setReadingMode,
    setTheme,
    setVariantType,
    theme,
  ])

  useEffect(() => {
    if (!hasResolvedInitialLocation.current || !activeChapterId || !variantType) {
      return
    }

    const currentUrl = new URL(window.location.href)
    const nextSearchParams = new URLSearchParams(currentUrl.search)
    nextSearchParams.set('chapter', activeChapterId)
    nextSearchParams.set('variant', variantType)

    if (quoteTargetParagraphId) {
      nextSearchParams.set('paragraph', quoteTargetParagraphId)
    } else {
      nextSearchParams.delete('paragraph')
    }

    if (quoteTargetParagraphEndId) {
      nextSearchParams.set('paragraphEnd', quoteTargetParagraphEndId)
    } else {
      nextSearchParams.delete('paragraphEnd')
    }

    const nextSearch = nextSearchParams.toString()
    const nextHref = nextSearch ? `${currentUrl.pathname}?${nextSearch}` : currentUrl.pathname
    const currentHref = `${currentUrl.pathname}${currentUrl.search}`
    if (nextHref !== currentHref) {
      window.history.replaceState(window.history.state, '', nextHref)
    }
  }, [activeChapterId, quoteTargetParagraphEndId, quoteTargetParagraphId, variantType])

  useEffect(() => {
    if (!activeChapterId) return

    if (readingMode === 'book') {
      if (!bookModeSection || bookModeSection.chapter.id !== activeChapterId || bookModeSection.variant.variantType !== variantType) {
        const frameId = window.requestAnimationFrame(() => {
          void fetchSingleChapter(activeChapterId, variantType).then((section) => {
            if (!section) return
            setBookModeSection(section)
            setAvailableVariants(section.chapter.variants.map((variant) => variant.variantType))
          })
        })
        return () => window.cancelAnimationFrame(frameId)
      }
      return
    }

    if (!feedSections.some((section) => section.chapter.id === activeChapterId)) {
      const frameId = window.requestAnimationFrame(() => {
        void replaceFeedSections(activeChapterId, variantType, 1, 1, 0, true)
      })
      return () => window.cancelAnimationFrame(frameId)
    }
  }, [activeChapterId, bookModeSection, feedSections, fetchSingleChapter, readingMode, replaceFeedSections, variantType])

  const handleActiveChapterChange = useCallback((nextChapterId: string, progress: number, fromScroll: boolean): void => {
    setActiveChapterId((current) => current === nextChapterId ? current : nextChapterId)
    setChapterId(nextChapterId)
    setScrollProgress(progress)
    saveReadingProgress(nextChapterId, progress)

    if (fromScroll) {
      setQuoteTargetParagraphId(null)
      setQuoteTargetParagraphEndId(null)
    }

    void loadChapterCommentCount(nextChapterId)

    if (activeChapterRef.current !== nextChapterId) {
      const activeFeedSection = feedSections.find((section) => section.chapter.id === nextChapterId)
      if (activeFeedSection) {
        setAvailableVariants(activeFeedSection.chapter.variants.map((variant) => variant.variantType))
      }
    }
  }, [feedSections, loadChapterCommentCount, saveReadingProgress, setChapterId])

  const loadMoreNext = useCallback(async (): Promise<void> => {
    if (!bookId || !feedHasMoreNext || feedLoadingNext || feedSections.length === 0) return

    setFeedLoadingNext(true)
    try {
      const lastSection = feedSections[feedSections.length - 1]
      const data = await fetchFeedWindow(bookId, lastSection.chapter.id, variantType, 0, 1)
      if (!data) return

      setFeedSections((current) => mergeSections(current, data.sections))
      setFeedHasMoreNext(data.hasNext)
      if (data.variantPresets) {
        setVariantPresets(data.variantPresets)
      }
    } finally {
      setFeedLoadingNext(false)
    }
  }, [bookId, feedHasMoreNext, feedLoadingNext, feedSections, fetchFeedWindow, variantType])

  const loadMorePrev = useCallback(async (): Promise<void> => {
    if (!bookId || !feedHasMorePrev || feedLoadingPrev || feedSections.length === 0) return

    setFeedLoadingPrev(true)
    try {
      const firstSection = feedSections[0]
      const data = await fetchFeedWindow(bookId, firstSection.chapter.id, variantType, 1, 0)
      if (!data) return

      setFeedSections((current) => mergeSections(current, data.sections))
      setFeedHasMorePrev(data.hasPrev)
      if (data.variantPresets) {
        setVariantPresets(data.variantPresets)
      }
    } finally {
      setFeedLoadingPrev(false)
    }
  }, [bookId, feedHasMorePrev, feedLoadingPrev, feedSections, fetchFeedWindow, variantType])

  const handleVariantChange = useCallback(async (newType: VariantType) => {
    if (!activeChapterId) return

    setQuoteTargetParagraphId(null)
    setQuoteTargetParagraphEndId(null)

    const exists = availableVariants.includes(newType)
    if (!exists) {
      const preset = variantPresets[newType]
      if (!preset?.id) return

      setGeneratingVariant(newType)
      try {
        const response = await fetch(`/api/chapters/${activeChapterId}/summarize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetIds: [preset.id] }),
        })
        if (!response.ok) {
          return
        }
      } catch (error) {
        console.error('Failed to generate variant:', error)
        return
      } finally {
        setGeneratingVariant(null)
      }
    }

    setVariantType(newType)

    if (readingMode === 'feed') {
      const activeIndex = feedSections.findIndex((section) => section.chapter.id === activeChapterId)
      const before = activeIndex >= 0 ? activeIndex : 1
      const after = activeIndex >= 0 ? feedSections.length - activeIndex - 1 : 1
      await replaceFeedSections(activeChapterId, newType, before, after, scrollProgress, false)
    } else {
      const section = await fetchSingleChapter(activeChapterId, newType)
      if (section) {
        setBookModeSection(section)
        setAvailableVariants(section.chapter.variants.map((variant) => variant.variantType))
      }
    }
  }, [
    activeChapterId,
    availableVariants,
    fetchSingleChapter,
    feedSections,
    readingMode,
    replaceFeedSections,
    scrollProgress,
    setVariantType,
    variantPresets,
  ])

  const handleChapterChange = useCallback(async (newChapterId: string) => {
    setQuoteTargetParagraphId(null)
    setQuoteTargetParagraphEndId(null)
    setActiveChapterId(newChapterId)
    setChapterId(newChapterId)
    setScrollProgress(0)
    void loadChapterCommentCount(newChapterId)

    if (readingMode === 'feed') {
      await replaceFeedSections(newChapterId, variantType, 1, 1, 0, true)
    } else {
      const section = await fetchSingleChapter(newChapterId, variantType)
      if (section) {
        setBookModeSection(section)
        setAvailableVariants(section.chapter.variants.map((variant) => variant.variantType))
      }
    }
  }, [fetchSingleChapter, readingMode, replaceFeedSections, setChapterId, variantType])

  const goToNextChapter = useCallback(() => {
    if (!bookData || !activeChapterId) return
    const currentIndex = bookData.chapters.findIndex((chapter) => chapter.id === activeChapterId)
    if (currentIndex < 0 || currentIndex >= bookData.chapters.length - 1) return
    void handleChapterChange(bookData.chapters[currentIndex + 1].id)
  }, [activeChapterId, bookData, handleChapterChange])

  const goToPrevChapter = useCallback(() => {
    if (!bookData || !activeChapterId) return
    const currentIndex = bookData.chapters.findIndex((chapter) => chapter.id === activeChapterId)
    if (currentIndex <= 0) return
    void handleChapterChange(bookData.chapters[currentIndex - 1].id)
  }, [activeChapterId, bookData, handleChapterChange])

  const handleSendComment = useCallback(async (body: string): Promise<ReaderComment | null> => {
    if (!activeChapterId || !bookId || !readerId || !username) return null

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
      const response = await fetch(`/api/chapters/${activeChapterId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readerId, username, body, bookId, quotes }),
      })
      if (!response.ok) {
        return null
      }

      const data = await response.json() as { comment?: ReaderComment }
      if (!data.comment) {
        return null
      }

      setReplyingTo(null)
      setFeedSections((current) => current.map((section) => (
        section.chapter.id === activeChapterId
          ? {
              ...section,
              commentsPreview: prependUniqueComment(section.commentsPreview, data.comment!, 5),
              commentCount: section.commentCount + 1,
            }
          : section
      )))
      void loadChapterCommentCount(activeChapterId)
      return data.comment
    } catch (error) {
      console.error('Failed to send comment:', error)
      return null
    }
  }, [activeChapterId, bookId, loadChapterCommentCount, readerId, replyingTo, setReplyingTo, username])

  const handleToggleBookmark = useCallback((targetChapterId: string, stableKey: string) => {
    setBookmarksByChapter((current) => {
      const next = { ...current }
      if (next[targetChapterId] === stableKey) {
        delete next[targetChapterId]
      } else {
        next[targetChapterId] = stableKey
      }
      saveBookmarks(next)
      return next
    })
  }, [])

  const scrollToBookmark = useCallback(() => {
    if (!activeChapterId) return
    const bookmarkedKey = bookmarksByChapter[activeChapterId]
    if (!bookmarkedKey) return

    const element = document.querySelector(
      `[data-chapter-id="${activeChapterId}"] [data-stable-key="${bookmarkedKey}"]`,
    )
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeChapterId, bookmarksByChapter])

  const toggleReadingMode = useCallback(async () => {
    if (!activeChapterId) return

    const nextMode: ReadingMode = readingMode === 'feed' ? 'book' : 'feed'
    setReadingMode(nextMode)

    if (nextMode === 'book') {
      const section = await fetchSingleChapter(activeChapterId, variantType)
      if (section) {
        setBookModeSection(section)
        setAvailableVariants(section.chapter.variants.map((variant) => variant.variantType))
      }
      return
    }

    const activeIndex = feedSections.findIndex((section) => section.chapter.id === activeChapterId)
    const before = activeIndex >= 0 ? activeIndex : 1
    const after = activeIndex >= 0 ? feedSections.length - activeIndex - 1 : 1
    await replaceFeedSections(activeChapterId, variantType, before, after, scrollProgress, false)
  }, [activeChapterId, feedSections, fetchSingleChapter, readingMode, replaceFeedSections, scrollProgress, setReadingMode, variantType])

  const chapters = bookData?.chapters || []
  const activeFeedSection = feedSections.find((section) => section.chapter.id === activeChapterId) || null
  const currentTitle = readingMode === 'feed'
    ? activeFeedSection?.chapter.title || bookModeSection?.chapter.title || ''
    : bookModeSection?.chapter.title || activeFeedSection?.chapter.title || ''
  const currentBookmark = activeChapterId ? bookmarksByChapter[activeChapterId] || null : null
  const currentChapterIndex = chapters.findIndex((entry) => entry.id === activeChapterId)
  const hasNextChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1
  const hasPrevChapter = currentChapterIndex > 0
  const progressPercent = Math.round(scrollProgress * 100)
  const themeVars = applyTheme(theme, accentTheme)

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

  if (!bookData) {
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
      <SearchPanel
        open={showSearch}
        onClose={() => setShowSearch(false)}
        contentRef={searchContentRef}
      />

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
            title={bookData.title}
          >
            {bookData.title}
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
              {currentTitle}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
              <div
                style={{
                  width: '2rem',
                  height: '3px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--r-border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--r-accent)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.625rem', color: 'var(--r-text-secondary)', minWidth: '1.75rem' }}>
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>

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

        <button
          onClick={currentBookmark ? scrollToBookmark : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            minWidth: '44px',
            minHeight: '44px',
            color: currentBookmark ? 'var(--r-accent)' : 'var(--r-text)',
            background: 'none',
            border: 'none',
            cursor: currentBookmark ? 'pointer' : 'default',
          }}
          title={currentBookmark ? 'Перейти к закладке' : 'Нет закладки'}
        >
          {currentBookmark ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
        </button>

        <button
          onClick={() => void toggleReadingMode()}
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

        <TableOfContents
          chapters={chapters}
          currentChapterId={activeChapterId || ''}
          onChapterChange={(nextChapterId) => { void handleChapterChange(nextChapterId) }}
        />

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

        <Link
          href="/me/annotations"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            minWidth: '44px',
            minHeight: '44px',
            color: 'var(--r-text)',
          }}
          title="Мои аннотации"
        >
          <UserRound size={20} />
        </Link>

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

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {readingMode === 'feed' ? (
            <FeedReader
              sections={feedSections}
              activeChapterId={activeChapterId}
              hasMorePrev={feedHasMorePrev}
              hasMoreNext={feedHasMoreNext}
              loadingPrev={feedLoadingPrev}
              loadingNext={feedLoadingNext}
              onLoadPrev={() => { void loadMorePrev() }}
              onLoadNext={() => { void loadMoreNext() }}
              onActiveChapterChange={handleActiveChapterChange}
              commentsSectionRef={commentsSectionRef}
              onSendComment={handleSendComment}
              setContentNode={setSearchContentNode}
              bookmarkedKeys={bookmarksByChapter}
              onToggleBookmark={handleToggleBookmark}
              authorSlug={authorSlug}
              bookSlug={bookSlug}
              highlightParagraphId={quoteTargetParagraphId}
              highlightParagraphEndId={quoteTargetParagraphEndId}
              restoreRequest={restoreRequest}
              scrollToChapterId={scrollToChapterId}
              onScrollToChapterHandled={() => setScrollToChapterId(null)}
            />
          ) : bookModeSection ? (
            <BookReader
              key={`${activeChapterId}-${variantType}-book`}
              paragraphs={bookModeSection.variant.paragraphs}
              variantId={bookModeSection.variant.id}
              hasNextChapter={hasNextChapter}
              hasPrevChapter={hasPrevChapter}
              onNextChapter={goToNextChapter}
              onPrevChapter={goToPrevChapter}
              chapterTitle={bookModeSection.chapter.title}
              onSendComment={handleSendComment}
              commentCount={commentCount}
              onProgress={(progress) => {
                setScrollProgress(progress)
                if (activeChapterId) {
                  saveReadingProgress(activeChapterId, progress)
                }
              }}
              bookmarkedKey={currentBookmark}
              onToggleBookmark={(stableKey) => activeChapterId && handleToggleBookmark(activeChapterId, stableKey)}
              searchOpen={showSearch}
              setContentNode={setSearchContentNode}
              authorSlug={authorSlug}
              bookSlug={bookSlug}
              highlightParagraphId={quoteTargetParagraphId}
              highlightParagraphEndId={quoteTargetParagraphEndId}
            />
          ) : null}
        </main>

        {showDesktopComments && activeChapterId && (
          <aside
            className="slide-up-enter desktop-sidebar-comments"
            style={{
              width: '320px',
              flexShrink: 0,
              borderLeft: '1px solid var(--r-border)',
              backgroundColor: 'var(--r-bg)',
              overflowY: 'auto',
              padding: '1rem',
              display: 'none',
            }}
          >
            <CommentsSection
              chapterId={activeChapterId}
              onSendComment={handleSendComment}
              authorSlug={authorSlug}
              bookSlug={bookSlug}
            />
          </aside>
        )}
      </div>

      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />

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
        .group:hover .bookmark-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}
