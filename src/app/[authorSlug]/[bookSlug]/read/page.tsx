'use client'

import { startTransition, useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { sortCommentsByTop } from '@/lib/annotations'
import { useReaderStore, type VariantType, type ReadingMode, type ReplyQuote } from '@/lib/store'
import { applyTheme } from '@/lib/themes'
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
import { setBookReaderPage } from '@/lib/book-reader-progress'
import {
  buildReaderLocationSearch,
  resolveReaderLocationSearch,
  shouldForceBookModeFromQuoteTarget,
} from '@/lib/reader-location'

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
  const quoteTargetParagraphIdRef = useRef<string | null>(null)
  const quoteTargetParagraphEndIdRef = useRef<string | null>(null)
  const chapterSectionCacheRef = useRef(new Map<string, FeedSectionData>())
  const chapterSectionRequestRef = useRef(new Map<string, Promise<FeedSectionData | null>>())
  const feedWindowPrefetchRef = useRef(new Set<string>())

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
    quoteTargetParagraphIdRef.current = quoteTargetParagraphId
    quoteTargetParagraphEndIdRef.current = quoteTargetParagraphEndId
  }, [quoteTargetParagraphEndId, quoteTargetParagraphId])

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
  }, [cacheBookSection, getChapterCacheKey, setVariantType])

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
      setFeedSections((current) => mergeSections(current, data.sections))

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

        if (shouldForceBookModeFromQuoteTarget({
          paragraph: urlParagraph,
          paragraphEnd: urlParagraphEnd,
          startOffsetRaw: urlStartOffsetRaw,
          endOffsetRaw: urlEndOffsetRaw,
        })) {
          // Quote links are page-centric, so we always open the paged reader
          // even if the last persisted session was in feed mode.
          targetMode = 'book'
        }

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
    })
    const nextHref = nextSearch ? `${currentUrl.pathname}?${nextSearch}` : currentUrl.pathname
    const currentHref = `${currentUrl.pathname}${currentUrl.search}`
    if (nextHref !== currentHref) {
      window.history.replaceState(window.history.state, '', nextHref)
    }
  }, [activeChapterId, quoteTargetEndOffset, quoteTargetParagraphEndId, quoteTargetParagraphId, quoteTargetStartOffset, variantType])

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
  }, [feedSections, saveReadingProgress, setChapterId])

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
    setBookReaderPage(localStorage, prevChapterId, 1)
    void handleChapterChange(prevChapterId)
  }, [activeChapterId, bookData, handleChapterChange])

  const buildChapterHref = useCallback((targetChapterId: string): string => {
    const searchParams = new URLSearchParams()
    searchParams.set('chapter', targetChapterId)
    searchParams.set('variant', variantType)

    return `/${authorSlug}/${bookSlug}/read?${searchParams.toString()}`
  }, [authorSlug, bookSlug, variantType])

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
              preview: {
                ...section.preview,
                ...buildAfterwordComments(prependUniqueComment(section.commentsPreview, data.comment!, 5)),
                stats: {
                  ...section.preview.stats,
                  commentsCount: section.preview.stats.commentsCount + 1,
                  topQuote: section.preview.quotesPreview[0] || section.preview.stats.topQuote,
                },
              },
              commentsPreview: prependUniqueComment(section.commentsPreview, data.comment!, 5),
              commentCount: section.commentCount + 1,
            }
          : section
      )))
      return data.comment
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
      className="reader-wrapper reader-shell h-screen flex flex-col"
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
        progressPercent={progressPercent}
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
