'use client'

import { startTransition, useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { sortCommentsByTop } from '@/lib/annotations'
import { useReaderStore, type VariantType, type ReadingMode, type ReplyQuote } from '@/lib/store'
import { applyTheme } from '@/lib/themes'
import { resolveInitialReadingMode } from '@/lib/reader-mode'
import FeedReader from '@/components/reader/FeedReader'
import BookReader from '@/components/reader/BookReader'
import SettingsPanel from '@/components/reader/SettingsPanel'
import TableOfContents from '@/components/reader/TableOfContents'
import SearchPanel from '@/components/reader/SearchPanel'
import UserActivityPanel from '@/components/reader/UserActivityPanel'
import ReaderChrome, { type ReaderChromeOverlay } from '@/components/reader/ReaderChrome'
import ReaderCommentsOverlay from '@/components/reader/ReaderCommentsOverlay'
import type { ReaderComment } from '@/components/reader/comment-types'
import type {
  FeedSectionData,
  ReaderChapterListItem,
} from '@/components/reader/feed-types'
import {
  resolveBookProgressPercent,
  setBookReaderPage,
  setBookReaderPageToLastPage,
} from '@/lib/book-reader-progress'
import {
  buildReaderLocationSearch,
  resolveReaderLocationSearch,
} from '@/lib/reader-location'
import {
  getEffectiveOfflineProgress,
  getOfflineBookRecord,
  getOfflineBookBySlugs,
  getOfflineChapterSection,
  getOfflineFeedWindow,
  queueOfflineComment,
  saveProgressUpdate,
} from '@/lib/offline-client'
import type { OfflineProgressRecord, VariantPresetRecord } from '@/lib/offline-types'
import { READING_STATS_HEARTBEAT_SECONDS } from '@/lib/reading-stats'

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

interface RestoreRequest {
  chapterId: string
  scrollPercent: number
  token: number
}

const BOOKMARKS_KEY = 'bookstream-bookmarks'
const READING_ACTIVITY_WINDOW_MS = 20_000

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
  return sortCommentsByTop(next).slice(0, limit)
}

function buildAfterwordComments(
  commentsPreview: ReaderComment[],
): Pick<FeedSectionData['preview'], 'leadComment' | 'freshComments'> {
  const sortedTop = sortCommentsByTop(commentsPreview)
  const leadComment = sortedTop[0] || null
  const freshComments = commentsPreview
    .filter((comment) => comment.id !== leadComment?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)

  return {
    leadComment,
    freshComments,
  }
}

export default function ReaderPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const authorSlug = params.authorSlug as string
  const bookSlug = params.bookSlug as string

  const {
    bookId,
    variantType,
    readingMode,
    theme,
    accentTheme,
    readerId,
    username,
    replyingTo,
    setBookId,
    setChapterId,
    setVariantType,
    setReadingMode,
    setFontSize,
    setLineHeight,
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
  const [chromeVisible, setChromeVisible] = useState(false)
  const [activeOverlay, setActiveOverlay] = useState<ReaderChromeOverlay>('none')
  const [variantsExpanded, setVariantsExpanded] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [bookmarksByChapter, setBookmarksByChapter] = useState<Record<string, string>>({})
  const [quoteTargetParagraphId, setQuoteTargetParagraphId] = useState<string | null>(null)
  const [quoteTargetParagraphEndId, setQuoteTargetParagraphEndId] = useState<string | null>(null)
  const [quoteTargetStartOffset, setQuoteTargetStartOffset] = useState<number | null>(null)
  const [quoteTargetEndOffset, setQuoteTargetEndOffset] = useState<number | null>(null)
  const [restoreRequest, setRestoreRequest] = useState<RestoreRequest | null>(null)
  const [scrollToChapterId, setScrollToChapterId] = useState<string | null>(null)
  const [commentsChapterId, setCommentsChapterId] = useState<string | null>(null)
  const commentsSectionRef = useRef<HTMLDivElement>(null)
  const searchContentRef = useRef<HTMLDivElement | null>(null)
  const initialized = useRef(false)
  const hasResolvedInitialLocation = useRef(false)
  const restoreTokenRef = useRef(0)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeChapterRef = useRef<string | null>(null)
  const variantTypeRef = useRef<VariantType>('original')
  const scrollProgressRef = useRef(0)
  const quoteTargetParagraphIdRef = useRef<string | null>(null)
  const quoteTargetParagraphEndIdRef = useRef<string | null>(null)
  const chapterSectionCacheRef = useRef(new Map<string, FeedSectionData>())
  const chapterSectionRequestRef = useRef(new Map<string, Promise<FeedSectionData | null>>())
  const feedWindowPrefetchRef = useRef(new Set<string>())
  const statsOpenSentRef = useRef(false)
  const lastActivityAtRef = useRef(Date.now())
  const lastStatsDispatchAtRef = useRef(Date.now())

  const setSearchContentNode = useCallback((node: HTMLDivElement | null) => {
    searchContentRef.current = node
  }, [])

  const getChapterCacheKey = useCallback((targetChapterId: string, requestedVariant: VariantType): string => (
    `${targetChapterId}:${requestedVariant}`
  ), [])

  const cacheBookSection = useCallback((section: FeedSectionData): void => {
    chapterSectionCacheRef.current.set(
      getChapterCacheKey(section.chapter.id, section.variant.variantType),
      section,
    )
  }, [getChapterCacheKey])

  const cacheBookSections = useCallback((sections: FeedSectionData[]): void => {
    for (const section of sections) {
      cacheBookSection(section)
    }
  }, [cacheBookSection])

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
    variantTypeRef.current = variantType
  }, [variantType])

  useEffect(() => {
    scrollProgressRef.current = scrollProgress
  }, [scrollProgress])

  useEffect(() => {
    quoteTargetParagraphIdRef.current = quoteTargetParagraphId
    quoteTargetParagraphEndIdRef.current = quoteTargetParagraphEndId
  }, [quoteTargetParagraphEndId, quoteTargetParagraphId])

  const markReaderActivity = useCallback((): void => {
    lastActivityAtRef.current = Date.now()
  }, [])

  const dispatchReadingStats = useCallback((
    eventType: 'open' | 'heartbeat',
    options?: { keepalive?: boolean; preferBeacon?: boolean },
  ): void => {
    if (!readerId || !bookId || !activeChapterRef.current || typeof navigator === 'undefined' || navigator.onLine === false) {
      return
    }

    const now = Date.now()
    const progressPercent = scrollProgressRef.current

    if (eventType === 'heartbeat') {
      const recentlyActive = now - lastActivityAtRef.current <= READING_ACTIVITY_WINDOW_MS
      if (!recentlyActive) {
        return
      }
    }

    const secondsDelta = eventType === 'heartbeat'
      ? Math.max(0, Math.min(READING_STATS_HEARTBEAT_SECONDS, Math.round((now - lastStatsDispatchAtRef.current) / 1000)))
      : 0

    if (eventType === 'heartbeat' && secondsDelta <= 0) {
      return
    }

    lastStatsDispatchAtRef.current = now

    const payload = JSON.stringify({
      readerId,
      bookId,
      chapterId: activeChapterRef.current,
      eventType,
      secondsDelta,
      progressPercent,
    })

    if (options?.preferBeacon && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/reading-stats', new Blob([payload], { type: 'application/json' }))
      return
    }

    void fetch('/api/reading-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: options?.keepalive,
    }).catch((error) => {
      console.error('Failed to record reading stats:', error)
    })
  }, [bookId, readerId])

  useEffect(() => {
    statsOpenSentRef.current = false
    lastActivityAtRef.current = Date.now()
    lastStatsDispatchAtRef.current = Date.now()
  }, [bookId, readerId])

  useEffect(() => {
    if (!bookId || !readerId || !activeChapterId || statsOpenSentRef.current || typeof navigator === 'undefined' || navigator.onLine === false) {
      return
    }

    statsOpenSentRef.current = true
    markReaderActivity()
    dispatchReadingStats('open')
  }, [activeChapterId, bookId, dispatchReadingStats, markReaderActivity, readerId])

  useEffect(() => {
    if (!bookId || !readerId) {
      return
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }

      dispatchReadingStats('heartbeat')
    }, READING_STATS_HEARTBEAT_SECONDS * 1000)

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        dispatchReadingStats('heartbeat', { keepalive: true, preferBeacon: true })
        return
      }

      markReaderActivity()
      lastStatsDispatchAtRef.current = Date.now()
    }

    const handlePageHide = (): void => {
      dispatchReadingStats('heartbeat', { keepalive: true, preferBeacon: true })
    }

    const handleInteraction = (): void => {
      markReaderActivity()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)
    window.addEventListener('pointerdown', handleInteraction, { passive: true })
    window.addEventListener('keydown', handleInteraction)
    window.addEventListener('wheel', handleInteraction, { passive: true })
    window.addEventListener('touchstart', handleInteraction, { passive: true })

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
      window.removeEventListener('pointerdown', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('wheel', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }
  }, [bookId, dispatchReadingStats, markReaderActivity, readerId])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault()
        setChromeVisible(true)
        setActiveOverlay('search')
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

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const previousHtmlStyle = {
      overflow: html.style.overflow,
      overscrollBehavior: html.style.overscrollBehavior,
      width: html.style.width,
      height: html.style.height,
    }
    const previousBodyStyle = {
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      width: body.style.width,
      height: body.style.height,
    }

    if (readingMode === 'book') {
      // Safari on iPhone can keep scrolling the root document when the browser chrome
      // expands or collapses. Lock the page shell only in book mode so the feed can scroll normally.
      html.style.overflow = 'hidden'
      html.style.overscrollBehavior = 'none'
      html.style.width = '100%'
      html.style.height = '100%'

      body.style.overflow = 'hidden'
      body.style.overscrollBehavior = 'none'
      body.style.width = '100%'
      body.style.height = '100%'
    } else {
      html.style.overflow = previousHtmlStyle.overflow
      html.style.overscrollBehavior = previousHtmlStyle.overscrollBehavior
      html.style.width = previousHtmlStyle.width
      html.style.height = previousHtmlStyle.height

      body.style.overflow = previousBodyStyle.overflow
      body.style.overscrollBehavior = previousBodyStyle.overscrollBehavior
      body.style.width = previousBodyStyle.width
      body.style.height = previousBodyStyle.height
    }

    return () => {
      html.style.overflow = previousHtmlStyle.overflow
      html.style.overscrollBehavior = previousHtmlStyle.overscrollBehavior
      html.style.width = previousHtmlStyle.width
      html.style.height = previousHtmlStyle.height

      body.style.overflow = previousBodyStyle.overflow
      body.style.overscrollBehavior = previousBodyStyle.overscrollBehavior
      body.style.width = previousBodyStyle.width
      body.style.height = previousBodyStyle.height
    }
  }, [readingMode])

  const fetchFeedWindow = useCallback(async (
    targetBookId: string,
    anchorId: string,
    requestedVariant: VariantType,
    before: number,
    after: number,
  ): Promise<FeedResponse | null> => {
    const offlineData = await getOfflineFeedWindow(targetBookId, anchorId, requestedVariant, before, after)
    if (offlineData) {
      return offlineData
    }

    const params = new URLSearchParams({
      anchorChapterId: anchorId,
      variantType: requestedVariant,
      before: String(before),
      after: String(after),
      previewLimit: '5',
    })
    if (readerId) {
      params.set('readerId', readerId)
    }
    const response = await fetch(`/api/books/${targetBookId}/feed?${params.toString()}`)
    if (!response.ok) {
      return null
    }
    return await response.json() as FeedResponse
  }, [readerId])

  const fetchSingleChapter = useCallback(async (
    targetChapterId: string,
    requestedVariant: VariantType,
  ): Promise<FeedSectionData | null> => {
    if (bookId) {
      const offlineSection = await getOfflineChapterSection(bookId, targetChapterId, requestedVariant)
      if (offlineSection) {
        cacheBookSection(offlineSection)
        return offlineSection
      }
    }

    const cacheKey = getChapterCacheKey(targetChapterId, requestedVariant)
    const cached = chapterSectionCacheRef.current.get(cacheKey)
    if (cached) {
      return cached
    }

    const pending = chapterSectionRequestRef.current.get(cacheKey)
    if (pending) {
      return await pending
    }

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

        const section: FeedSectionData = {
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
          preview: {
            leadComment: null,
            freshComments: [],
            quotesPreview: [],
            stats: {
              commentsCount: 0,
              reactionsCount: 0,
              quotesCount: 0,
              bookmarksCount: null,
              topQuote: null,
            },
          },
          commentsPreview: [],
          commentCount: 0,
          prevChapterId: data.prevChapter?.id || null,
          nextChapterId: data.nextChapter?.id || null,
        }

        cacheBookSection(section)
        return section
      }

      if (response.status === 404 && nextVariant !== 'original') {
        setVariantType('original')
        return requestChapter('original')
      }

      return null
    }

    const request = requestChapter(requestedVariant)
    chapterSectionRequestRef.current.set(cacheKey, request)

    try {
      return await request
    } finally {
      chapterSectionRequestRef.current.delete(cacheKey)
    }
  }, [bookId, cacheBookSection, getChapterCacheKey, setVariantType])

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

    cacheBookSections(data.sections)
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
  }, [applyActiveVariantOptions, bookId, cacheBookSections, fetchFeedWindow])

  const prefetchFeedWindow = useCallback(async (
    anchorId: string,
    requestedVariant: VariantType,
    before: number,
    after: number,
  ): Promise<void> => {
    if (!bookId) return

    const prefetchKey = `${anchorId}:${requestedVariant}:${before}:${after}`
    if (feedWindowPrefetchRef.current.has(prefetchKey)) return

    feedWindowPrefetchRef.current.add(prefetchKey)

    try {
      const data = await fetchFeedWindow(bookId, anchorId, requestedVariant, before, after)
      if (!data) return

      cacheBookSections(data.sections)

      if (!(before > 0 && after === 0)) {
        setFeedSections((current) => mergeSections(current, data.sections))
      }

      if (before > 0) {
        setFeedHasMorePrev((current) => current || data.hasPrev)
      }
      if (after > 0) {
        setFeedHasMoreNext((current) => current || data.hasNext)
      }
      if (data.variantPresets) {
        setVariantPresets(data.variantPresets)
      }
    } finally {
      feedWindowPrefetchRef.current.delete(prefetchKey)
    }
  }, [bookId, cacheBookSections, fetchFeedWindow])

  const saveReadingProgress = useCallback((targetChapterId: string, progress: number): void => {
    if (!bookId || !readerId) return

    markReaderActivity()

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveProgressUpdate({
          readerId,
          bookId,
          chapterId: targetChapterId,
          variantType: useReaderStore.getState().variantType,
          scrollPercent: progress,
          fontSize: useReaderStore.getState().fontSize,
          lineHeight: useReaderStore.getState().lineHeight,
          readingMode: useReaderStore.getState().readingMode,
          updatedAt: new Date().toISOString(),
        })
      } catch (error) {
        console.error('Failed to save progress:', error)
      }
    }, 1200)
  }, [bookId, markReaderActivity, readerId])

  const saveReadingMode = useCallback(async (nextMode: ReadingMode): Promise<void> => {
    if (!bookId || !readerId || !activeChapterId) return

    markReaderActivity()

    try {
      await saveProgressUpdate({
        readerId,
        bookId,
        chapterId: activeChapterId,
        variantType,
        scrollPercent: scrollProgress,
        fontSize: useReaderStore.getState().fontSize,
        lineHeight: useReaderStore.getState().lineHeight,
        readingMode: nextMode,
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to save reading mode:', error)
    }
  }, [activeChapterId, bookId, markReaderActivity, readerId, scrollProgress, variantType])

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
        const offlineRecord = await getOfflineBookBySlugs(authorSlug, bookSlug)
        let book: BookData | null = offlineRecord ? {
          id: offlineRecord.book.id,
          slug: offlineRecord.book.slug,
          title: offlineRecord.book.title,
          readingModeDefault: offlineRecord.book.readingModeDefault,
          author: offlineRecord.book.author,
          chapters: offlineRecord.chapterList,
        } : null

        if (navigator.onLine !== false) {
          try {
            const bookRes = await fetch(`/api/books/${bookSlug}?authorSlug=${authorSlug}`)
            if (bookRes.ok) {
              book = await bookRes.json() as BookData
            }
          } catch (error) {
            console.error('Failed to fetch online book metadata:', error)
          }
        }

        if (!book) {
          setLoading(false)
          hasResolvedInitialLocation.current = true
          return
        }

        setBookData(book)
        setBookId(book.id)

        let targetChapterId = book.chapters[0]?.id || null
        let targetVariant = 'original' as VariantType
        let restoreScrollPercent = 0
        const { hasStoredReadingMode, readingMode: storedReadingMode } = useReaderStore.getState()
        let progressReadingMode: ReadingMode | null = null
        let mergedProgress: OfflineProgressRecord | null = null

        try {
          let serverProgress: OfflineProgressRecord | null = offlineRecord?.serverProgress || null

          if (navigator.onLine !== false) {
            const progressRes = await fetch(`/api/progress?readerId=${readerId}&bookId=${book.id}`)
            if (progressRes.ok) {
              const progressData = await progressRes.json() as {
                chapterId?: string
                variantType?: string
                fontSize?: number
                lineHeight?: number
                readingMode?: ReadingMode
                scrollPercent?: number
                updatedAt?: string
              } | null

              if (progressData?.chapterId) {
                serverProgress = {
                  readerId,
                  bookId: book.id,
                  chapterId: progressData.chapterId,
                  variantType: progressData.variantType || 'original',
                  scrollPercent: progressData.scrollPercent ?? 0,
                  fontSize: progressData.fontSize ?? 18,
                  lineHeight: progressData.lineHeight ?? 1.6,
                  readingMode: progressData.readingMode || 'feed',
                  updatedAt: progressData.updatedAt || new Date().toISOString(),
                }
              }
            }
          }

          mergedProgress = await getEffectiveOfflineProgress(book.id, readerId, serverProgress)
          if (mergedProgress) {
            targetChapterId = mergedProgress.chapterId || targetChapterId
            targetVariant = mergedProgress.variantType || targetVariant
            progressReadingMode = mergedProgress.readingMode || null
            restoreScrollPercent = mergedProgress.scrollPercent ?? 0
            if (mergedProgress.fontSize) setFontSize(mergedProgress.fontSize)
            if (mergedProgress.lineHeight) setLineHeight(mergedProgress.lineHeight)
          }
        } catch {
          // Ignore missing progress during boot.
        }

        const queryParams = new URLSearchParams(window.location.search)
        const urlChapter = queryParams.get('chapter')
        const urlVariant = queryParams.get('variant')
        const urlMode = queryParams.get('mode') as ReadingMode | null
        const urlParagraph = queryParams.get('paragraph')
        const urlParagraphEnd = queryParams.get('paragraphEnd')
        const urlStartOffsetRaw = queryParams.get('startOffset')
        const urlEndOffsetRaw = queryParams.get('endOffset')
        const urlStartOffset = Number.isFinite(Number(urlStartOffsetRaw)) ? Number(urlStartOffsetRaw) : null
        const urlEndOffset = Number.isFinite(Number(urlEndOffsetRaw)) ? Number(urlEndOffsetRaw) : null

        if (urlChapter && book.chapters.some((chapter) => chapter.id === urlChapter)) {
          targetChapterId = urlChapter
          restoreScrollPercent = 0
        }
        if (urlVariant) {
          targetVariant = urlVariant as VariantType
        }

        const targetMode = resolveInitialReadingMode({
          bookDefaultMode: book.readingModeDefault || 'feed',
          urlReadingMode: urlMode === 'book' || urlMode === 'feed' ? urlMode : null,
          storedReadingMode: hasStoredReadingMode ? storedReadingMode : null,
          hasStoredReadingMode,
          progressReadingMode,
        })

        setQuoteTargetParagraphId(urlParagraph)
        setQuoteTargetParagraphEndId(urlParagraphEnd)
        setQuoteTargetStartOffset(urlStartOffset)
        setQuoteTargetEndOffset(urlEndOffset)

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
            preview: {
              leadComment: null,
              freshComments: [],
              quotesPreview: [],
              stats: {
                commentsCount: 0,
                reactionsCount: 0,
                quotesCount: 0,
                bookmarksCount: null,
                topQuote: null,
              },
            },
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
            cacheBookSections(data.sections)
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
    cacheBookSections,
    fetchFeedWindow,
    fetchSingleChapter,
    readerId,
    setBookId,
    setChapterId,
    setFontSize,
    setLineHeight,
    setReadingMode,
    setVariantType,
  ])

  useEffect(() => {
    if (!hasResolvedInitialLocation.current || !activeChapterId || !variantType) {
      return
    }

    const currentUrl = new URL(window.location.href)
    const nextSearch = buildReaderLocationSearch({
      chapterId: activeChapterId,
      variantType,
      paragraphId: quoteTargetParagraphId,
      paragraphEndId: quoteTargetParagraphEndId,
      startOffset: quoteTargetStartOffset,
      endOffset: quoteTargetEndOffset,
      readingMode,
    })
    const nextHref = nextSearch ? `${currentUrl.pathname}?${nextSearch}` : currentUrl.pathname
    const currentHref = `${currentUrl.pathname}${currentUrl.search}`
    if (nextHref !== currentHref) {
      window.history.replaceState(window.history.state, '', nextHref)
    }
  }, [activeChapterId, quoteTargetEndOffset, quoteTargetParagraphEndId, quoteTargetParagraphId, quoteTargetStartOffset, readingMode, variantType])

  useEffect(() => {
    if (!hasResolvedInitialLocation.current || !bookData || !readerId) {
      return
    }

    const effectiveSearch = resolveReaderLocationSearch(searchParams.toString(), window.location.search)
    const effectiveSearchParams = new URLSearchParams(effectiveSearch)
    const urlChapter = effectiveSearchParams.get('chapter')
    const urlVariant = effectiveSearchParams.get('variant')
    const urlParagraph = effectiveSearchParams.get('paragraph')
    const urlParagraphEnd = effectiveSearchParams.get('paragraphEnd')
    const urlStartOffsetRaw = effectiveSearchParams.get('startOffset')
    const urlEndOffsetRaw = effectiveSearchParams.get('endOffset')
    const urlStartOffset = Number.isFinite(Number(urlStartOffsetRaw)) ? Number(urlStartOffsetRaw) : null
    const urlEndOffset = Number.isFinite(Number(urlEndOffsetRaw)) ? Number(urlEndOffsetRaw) : null

    const nextChapterId = urlChapter && bookData.chapters.some((chapter) => chapter.id === urlChapter)
      ? urlChapter
      : activeChapterRef.current
    const nextVariant = (urlVariant || variantTypeRef.current) as VariantType

    if (
      urlParagraph !== quoteTargetParagraphIdRef.current ||
      urlParagraphEnd !== quoteTargetParagraphEndIdRef.current ||
      urlStartOffset !== quoteTargetStartOffset ||
      urlEndOffset !== quoteTargetEndOffset
    ) {
      startTransition(() => {
        setQuoteTargetParagraphId(urlParagraph)
        setQuoteTargetParagraphEndId(urlParagraphEnd)
        setQuoteTargetStartOffset(urlStartOffset)
        setQuoteTargetEndOffset(urlEndOffset)
      })
    }

    if (!nextChapterId) {
      return
    }

    const needsChapterOrVariantSync =
      nextChapterId !== activeChapterRef.current || nextVariant !== variantTypeRef.current
    if (!needsChapterOrVariantSync) {
      return
    }

    startTransition(() => {
      setActiveChapterId(nextChapterId)
      setChapterId(nextChapterId)
      setVariantType(nextVariant)
    })

    const syncReaderLocation = async (): Promise<void> => {
      if (readingMode === 'feed') {
        await replaceFeedSections(nextChapterId, nextVariant, 1, 1, 0, true)
        return
      }

      const section = await fetchSingleChapter(nextChapterId, nextVariant)
      if (!section) {
        return
      }

      setBookModeSection(section)
      setAvailableVariants(section.chapter.variants.map((variant) => variant.variantType))
      setScrollProgress(0)
    }

    void syncReaderLocation()
  }, [
    bookData,
    fetchSingleChapter,
    quoteTargetEndOffset,
    quoteTargetStartOffset,
    readerId,
    readingMode,
    replaceFeedSections,
    searchParams,
    setChapterId,
    setVariantType,
    variantType,
  ])

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

  useEffect(() => {
    if (!bookData || !activeChapterId) return

    const currentIndex = bookData.chapters.findIndex((chapter) => chapter.id === activeChapterId)
    if (currentIndex < 0) return

    const prevChapterId = bookData.chapters[currentIndex - 1]?.id || null
    const nextChapterId = bookData.chapters[currentIndex + 1]?.id || null

    if (readingMode === 'book') {
      if (prevChapterId) {
        void fetchSingleChapter(prevChapterId, variantType)
      }
      if (nextChapterId) {
        void fetchSingleChapter(nextChapterId, variantType)
      }
      return
    }

    if (prevChapterId && !feedSections.some((section) => section.chapter.id === prevChapterId)) {
      void prefetchFeedWindow(activeChapterId, variantType, 1, 0)
    }

    if (nextChapterId && !feedSections.some((section) => section.chapter.id === nextChapterId)) {
      void prefetchFeedWindow(activeChapterId, variantType, 0, 1)
    }
  }, [activeChapterId, bookData, feedSections, fetchSingleChapter, prefetchFeedWindow, readingMode, variantType])

  const handleActiveChapterChange = useCallback((nextChapterId: string, progress: number, fromScroll: boolean): void => {
    markReaderActivity()
    setActiveChapterId((current) => current === nextChapterId ? current : nextChapterId)
    setChapterId(nextChapterId)
    setScrollProgress(progress)
    saveReadingProgress(nextChapterId, progress)

    if (fromScroll) {
      setQuoteTargetParagraphId(null)
      setQuoteTargetParagraphEndId(null)
      setQuoteTargetStartOffset(null)
      setQuoteTargetEndOffset(null)
    }

    if (activeChapterRef.current !== nextChapterId) {
      const activeFeedSection = feedSections.find((section) => section.chapter.id === nextChapterId)
      if (activeFeedSection) {
        setAvailableVariants(activeFeedSection.chapter.variants.map((variant) => variant.variantType))
      }
    }
  }, [feedSections, markReaderActivity, saveReadingProgress, setChapterId])

  const loadMoreNext = useCallback(async (): Promise<void> => {
    if (!bookId || !feedHasMoreNext || feedLoadingNext || feedSections.length === 0) return

    setFeedLoadingNext(true)
    try {
      const lastSection = feedSections[feedSections.length - 1]
      const data = await fetchFeedWindow(bookId, lastSection.chapter.id, variantType, 0, 1)
      if (!data) return

      cacheBookSections(data.sections)
      setFeedSections((current) => mergeSections(current, data.sections))
      setFeedHasMoreNext(data.hasNext)
      if (data.variantPresets) {
        setVariantPresets(data.variantPresets)
      }
    } finally {
      setFeedLoadingNext(false)
    }
  }, [bookId, cacheBookSections, feedHasMoreNext, feedLoadingNext, feedSections, fetchFeedWindow, variantType])

  const loadMorePrev = useCallback(async (): Promise<void> => {
    if (!bookId || !feedHasMorePrev || feedLoadingPrev || feedSections.length === 0) return

    setFeedLoadingPrev(true)
    try {
      const firstSection = feedSections[0]
      const data = await fetchFeedWindow(bookId, firstSection.chapter.id, variantType, 1, 0)
      if (!data) return

      cacheBookSections(data.sections)
      setFeedSections((current) => mergeSections(current, data.sections))
      setFeedHasMorePrev(data.hasPrev)
      if (data.variantPresets) {
        setVariantPresets(data.variantPresets)
      }
    } finally {
      setFeedLoadingPrev(false)
    }
  }, [bookId, cacheBookSections, feedHasMorePrev, feedLoadingPrev, feedSections, fetchFeedWindow, variantType])

  const handleVariantChange = useCallback(async (newType: VariantType) => {
    if (!activeChapterId) return

    setQuoteTargetParagraphId(null)
    setQuoteTargetParagraphEndId(null)
    setQuoteTargetStartOffset(null)
    setQuoteTargetEndOffset(null)

    const exists = availableVariants.includes(newType)
    if (!exists) {
      const preset = variantPresets[newType]
      if (!preset?.id) return

      setGeneratingVariant(newType)
      try {
        const attemptGeneration = async (useReaderLlm: boolean): Promise<Response> => await fetch(
          `/api/chapters/${activeChapterId}/summarize`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              presetIds: [preset.id],
              requesterReaderId: readerId,
              useReaderLlm,
            }),
          }
        )

        let response = await attemptGeneration(false)
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as {
            error?: string
            requiresReaderLlmConsent?: boolean
            missingReaderLlmConfig?: boolean
          }

          if (payload.requiresReaderLlmConsent) {
            const confirmed = window.confirm('Владелец книги не оплачивает генерацию. Использовать ваши LLM-настройки и сгенерировать вариант за ваш счёт?')
            if (!confirmed) {
              return
            }

            response = await attemptGeneration(true)
          } else if (payload.missingReaderLlmConfig) {
            window.alert(payload.error || 'Для генерации нужны ваши LLM-настройки в профиле.')
            return
          } else {
            console.error('Failed to generate variant:', payload.error || response.statusText)
            return
          }
        }

        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string }
          console.error('Failed to generate variant:', payload.error || response.statusText)
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
    readerId,
    scrollProgress,
    setVariantType,
    variantPresets,
  ])

  const handleChapterChange = useCallback(async (newChapterId: string) => {
    setQuoteTargetParagraphId(null)
    setQuoteTargetParagraphEndId(null)
    setQuoteTargetStartOffset(null)
    setQuoteTargetEndOffset(null)

    if (readingMode === 'feed') {
      setActiveChapterId(newChapterId)
      setChapterId(newChapterId)
      setScrollProgress(0)
      await replaceFeedSections(newChapterId, variantType, 1, 1, 0, true)
    } else {
      const section = await fetchSingleChapter(newChapterId, variantType)
      if (section) {
        setBookModeSection(section)
        setAvailableVariants(section.chapter.variants.map((variant) => variant.variantType))
        setActiveChapterId(newChapterId)
        setChapterId(newChapterId)
        setScrollProgress(0)
      }
    }
  }, [fetchSingleChapter, readingMode, replaceFeedSections, setChapterId, variantType])

  const goToNextChapter = useCallback(() => {
    if (!bookData || !activeChapterId) return
    const currentIndex = bookData.chapters.findIndex((chapter) => chapter.id === activeChapterId)
    if (currentIndex < 0 || currentIndex >= bookData.chapters.length - 1) return
    const nextChapterId = bookData.chapters[currentIndex + 1].id
    setBookReaderPage(localStorage, nextChapterId, 1)
    void handleChapterChange(nextChapterId)
  }, [activeChapterId, bookData, handleChapterChange])

  const goToPrevChapter = useCallback(() => {
    if (!bookData || !activeChapterId) return
    const currentIndex = bookData.chapters.findIndex((chapter) => chapter.id === activeChapterId)
    if (currentIndex <= 0) return
    const prevChapterId = bookData.chapters[currentIndex - 1].id
    setBookReaderPageToLastPage(localStorage, prevChapterId)
    void handleChapterChange(prevChapterId)
  }, [activeChapterId, bookData, handleChapterChange])

  const buildChapterHref = useCallback((targetChapterId: string): string => {
    const searchParams = new URLSearchParams()
    searchParams.set('chapter', targetChapterId)
    searchParams.set('variant', variantType)
    searchParams.set('mode', readingMode)

    return `/${authorSlug}/${bookSlug}/read?${searchParams.toString()}`
  }, [authorSlug, bookSlug, readingMode, variantType])

  const prefetchNextChapter = useCallback((): void => {
    if (!bookData || !activeChapterId) return

    const currentIndex = bookData.chapters.findIndex((chapter) => chapter.id === activeChapterId)
    if (currentIndex < 0 || currentIndex >= bookData.chapters.length - 1) return

    const nextChapterId = bookData.chapters[currentIndex + 1].id
    router.prefetch(buildChapterHref(nextChapterId))

    if (readingMode === 'book') {
      void fetchSingleChapter(nextChapterId, variantType)
    } else {
      void prefetchFeedWindow(activeChapterId, variantType, 0, 1)
    }
  }, [activeChapterId, bookData, buildChapterHref, fetchSingleChapter, prefetchFeedWindow, readingMode, router, variantType])

  const prefetchPrevChapter = useCallback((): void => {
    if (!bookData || !activeChapterId) return

    const currentIndex = bookData.chapters.findIndex((chapter) => chapter.id === activeChapterId)
    if (currentIndex <= 0) return

    const prevChapterId = bookData.chapters[currentIndex - 1].id
    router.prefetch(buildChapterHref(prevChapterId))

    if (readingMode === 'book') {
      void fetchSingleChapter(prevChapterId, variantType)
    } else {
      void prefetchFeedWindow(activeChapterId, variantType, 1, 0)
    }
  }, [activeChapterId, bookData, buildChapterHref, fetchSingleChapter, prefetchFeedWindow, readingMode, router, variantType])

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
      const offlineRecord = await getOfflineBookRecord(bookId)
      const nextComment = offlineRecord
        ? await queueOfflineComment({ readerId, username, body, bookId, chapterId: activeChapterId, quotes })
        : await (async (): Promise<ReaderComment | null> => {
            const response = await fetch(`/api/chapters/${activeChapterId}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ readerId, username, body, bookId, quotes }),
            })
            if (!response.ok) {
              return null
            }

            const data = await response.json() as { comment?: ReaderComment }
            return data.comment || null
          })()
      if (!nextComment) {
        return null
      }
      setReplyingTo(null)
      setFeedSections((current) => current.map((section) => (
        section.chapter.id === activeChapterId
          ? {
              ...section,
              preview: {
                ...section.preview,
                ...buildAfterwordComments(prependUniqueComment(section.commentsPreview, nextComment, 5)),
                stats: {
                  ...section.preview.stats,
                  commentsCount: section.preview.stats.commentsCount + 1,
                  topQuote: section.preview.quotesPreview[0] || section.preview.stats.topQuote,
                },
              },
              commentsPreview: prependUniqueComment(section.commentsPreview, nextComment, 5),
              commentCount: section.commentCount + 1,
            }
          : section
      )))
      return nextComment
    } catch (error) {
      console.error('Failed to send comment:', error)
      return null
    }
  }, [activeChapterId, bookId, readerId, replyingTo, setReplyingTo, username])

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

  const closeChrome = useCallback(() => {
    setChromeVisible(false)
    setActiveOverlay('none')
    setVariantsExpanded(false)
  }, [])

  const openChrome = useCallback(() => {
    setChromeVisible(true)
    setActiveOverlay('none')
    setVariantsExpanded(false)
  }, [])

  const openOverlay = useCallback((overlay: Exclude<ReaderChromeOverlay, 'none'>) => {
    setChromeVisible(true)
    setVariantsExpanded(false)
    setActiveOverlay(overlay)
  }, [])

  const closeOverlay = useCallback(() => {
    setActiveOverlay('none')
    setVariantsExpanded(false)
  }, [])

  const toggleChrome = useCallback(() => {
    setChromeVisible((current) => {
      const nextVisible = !current
      if (!nextVisible) {
        setActiveOverlay('none')
        setVariantsExpanded(false)
      }
      return nextVisible
    })
  }, [])

  const toggleReadingMode = useCallback(async () => {
    if (!activeChapterId) return

    const nextMode: ReadingMode = readingMode === 'feed' ? 'book' : 'feed'
    setReadingMode(nextMode)
    void saveReadingMode(nextMode)

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
  }, [activeChapterId, feedSections, fetchSingleChapter, readingMode, replaceFeedSections, saveReadingMode, scrollProgress, setReadingMode, variantType])

  const chapters = bookData?.chapters || []
  const activeFeedSection = feedSections.find((section) => section.chapter.id === activeChapterId) || null
  const currentTitle = readingMode === 'feed'
    ? activeFeedSection?.chapter.title || bookModeSection?.chapter.title || ''
    : bookModeSection?.chapter.title || activeFeedSection?.chapter.title || ''
  const currentBookmark = activeChapterId ? bookmarksByChapter[activeChapterId] || null : null
  const currentChapterIndex = chapters.findIndex((entry) => entry.id === activeChapterId)
  const hasNextChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1
  const hasPrevChapter = currentChapterIndex > 0
  const bookProgressPercent = resolveBookProgressPercent(currentChapterIndex, scrollProgress, chapters.length)
  const themeVars = applyTheme(theme, accentTheme)
  const commentsChapter = commentsChapterId
    ? chapters.find((chapter) => chapter.id === commentsChapterId) || null
    : null

  const handleBackToBook = useCallback(() => {
    router.push(`/${authorSlug}/${bookSlug}`)
  }, [authorSlug, bookSlug, router])

  const handleOpenComments = useCallback((targetChapterId?: string | null, replyTo?: ReplyQuote | null) => {
    const nextChapterId = targetChapterId || activeChapterId
    if (!nextChapterId) {
      return
    }

    if (activeOverlay === 'comments' && commentsChapterId === nextChapterId && !replyTo) {
      closeOverlay()
      return
    }

    setReplyingTo(replyTo || null)
    setCommentsChapterId(nextChapterId)
    openOverlay('comments')
  }, [activeChapterId, activeOverlay, closeOverlay, commentsChapterId, openOverlay, setReplyingTo])

  const handleQuickActionVariants = useCallback((open: boolean) => {
    setChromeVisible(true)
    setActiveOverlay('quick-actions')
    setVariantsExpanded(open)
  }, [])

  const handleQuickActionSearch = useCallback(() => {
    openOverlay('search')
  }, [openOverlay])

  const handleQuickActionSettings = useCallback(() => {
    openOverlay('settings')
  }, [openOverlay])

  const handleQuickActionReadingMode = useCallback(async () => {
    await toggleReadingMode()
    closeChrome()
  }, [closeChrome, toggleReadingMode])

  const handleVariantSelection = useCallback(async (newType: VariantType) => {
    await handleVariantChange(newType)
    closeChrome()
  }, [closeChrome, handleVariantChange])

  const handleChromeChapterChange = useCallback(async (newChapterId: string) => {
    await handleChapterChange(newChapterId)
    closeChrome()
  }, [closeChrome, handleChapterChange])

  const handleCommentsOpenChange = useCallback((open: boolean) => {
    if (open) {
      openOverlay('comments')
      return
    }

    closeOverlay()
  }, [closeOverlay, openOverlay])

  if (loading) {
    return (
      <div className="flex min-h-[100svh] flex-col overflow-hidden bg-background">
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
      <div className="flex min-h-[100svh] items-center justify-center overflow-hidden bg-background">
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
      className="reader-wrapper reader-shell flex h-[100svh] min-h-[100svh] flex-col overflow-hidden"
      data-reader-theme={theme}
      style={themeVars as React.CSSProperties}
    >
      <SearchPanel
        open={activeOverlay === 'search'}
        onClose={closeOverlay}
        contentRef={searchContentRef}
      />

      <ReaderChrome
        visible={chromeVisible}
        activeOverlay={activeOverlay}
        bookTitle={bookData.title}
        chapterTitle={currentTitle}
        bookProgressPercent={bookProgressPercent}
        readingMode={readingMode}
        hasBookmark={Boolean(currentBookmark)}
        variantsExpanded={variantsExpanded}
        generatedVariants={availableVariants}
        variantPresets={variantPresets}
        generatingVariant={generatingVariant}
        onBack={handleBackToBook}
        onClose={closeChrome}
        onOpenTOC={() => openOverlay('toc')}
        onOpenActivity={() => openOverlay('activity')}
        onOpenComments={() => handleOpenComments(activeChapterId)}
        onToggleQuickActions={() => {
          setChromeVisible(true)
          setActiveOverlay((current) => {
            const next = current === 'quick-actions' ? 'none' : 'quick-actions'
            if (next !== 'quick-actions') {
              setVariantsExpanded(false)
            }
            return next
          })
        }}
        onOpenSearch={handleQuickActionSearch}
        onOpenSettings={handleQuickActionSettings}
        onToggleVariants={handleQuickActionVariants}
        onVariantChange={(nextType) => { void handleVariantSelection(nextType) }}
        onToggleReadingMode={() => { void handleQuickActionReadingMode() }}
        onGoToBookmark={() => {
          scrollToBookmark()
          closeChrome()
        }}
      />

      <TableOfContents
        chapters={chapters}
        currentChapterId={activeChapterId || ''}
        open={activeOverlay === 'toc'}
        onOpenChange={(open) => {
          if (open) {
            openOverlay('toc')
          } else {
            closeOverlay()
          }
        }}
        onChapterChange={(nextChapterId) => { void handleChromeChapterChange(nextChapterId) }}
        showTrigger={false}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', display: 'flex' }}>
        <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', display: 'flex' }}>
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
              setContentNode={setSearchContentNode}
              bookmarkedKeys={bookmarksByChapter}
              onToggleBookmark={handleToggleBookmark}
              authorSlug={authorSlug}
              bookSlug={bookSlug}
              highlightParagraphId={quoteTargetParagraphId}
              highlightParagraphEndId={quoteTargetParagraphEndId}
              highlightStartOffset={quoteTargetStartOffset}
              highlightEndOffset={quoteTargetEndOffset}
              restoreRequest={restoreRequest}
              scrollToChapterId={scrollToChapterId}
              onScrollToChapterHandled={() => setScrollToChapterId(null)}
              onOpenChapterComments={handleOpenComments}
              onSurfaceTap={toggleChrome}
              onNavigate={closeChrome}
            />
          ) : bookModeSection ? (
            <BookReader
              key={`${activeChapterId}-${variantType}-book`}
              paragraphs={bookModeSection.variant.paragraphs}
              variantId={bookModeSection.variant.id}
              hasNextChapter={hasNextChapter}
              hasPrevChapter={hasPrevChapter}
              bookProgressPercent={bookProgressPercent}
              onNextChapter={goToNextChapter}
              onPrevChapter={goToPrevChapter}
              prefetchNextChapter={prefetchNextChapter}
              prefetchPrevChapter={prefetchPrevChapter}
              chapterTitle={bookModeSection.chapter.title}
              onProgress={(progress) => {
                setScrollProgress(progress)
                if (activeChapterId) {
                  saveReadingProgress(activeChapterId, progress)
                }
              }}
              setContentNode={setSearchContentNode}
              highlightParagraphId={quoteTargetParagraphId}
              highlightParagraphEndId={quoteTargetParagraphEndId}
              highlightStartOffset={quoteTargetStartOffset}
              highlightEndOffset={quoteTargetEndOffset}
              onCenterTap={toggleChrome}
              onNavigate={closeChrome}
            />
          ) : null}
        </main>
      </div>

      <ReaderCommentsOverlay
        open={activeOverlay === 'comments'}
        chapterId={commentsChapterId}
        chapterTitle={commentsChapter?.title || currentTitle}
        onOpenChange={handleCommentsOpenChange}
        onSendComment={handleSendComment}
        commentsSectionRef={commentsSectionRef}
        authorSlug={authorSlug}
        bookSlug={bookSlug}
      />

      <UserActivityPanel
        open={activeOverlay === 'activity' && Boolean(bookData.id)}
        onOpenChange={(open) => {
          if (open) {
            openOverlay('activity')
          } else {
            closeOverlay()
          }
        }}
        bookId={bookData.id}
        bookTitle={bookData.title}
        authorSlug={authorSlug}
        bookSlug={bookSlug}
      />

      <SettingsPanel
        open={activeOverlay === 'settings'}
        onOpenChange={(open) => {
          if (open) {
            openOverlay('settings')
          } else {
            closeOverlay()
          }
        }}
      />
    </div>
  )
}
