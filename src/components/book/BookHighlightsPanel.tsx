'use client'

import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  MessageSquare,
  MessageSquareQuote,
  Plus,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useReaderStore } from '@/lib/store'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import { cn } from '@/lib/utils'

type SectionKey = 'comments' | 'quotes' | 'toc'

interface Chapter {
  id: string
  title: string
  position: number
  variants: Array<{ id: string; variantType: string }>
}

interface BookComment {
  id: string
  chapterId: string
  username: string
  body: string
  createdAt: string
  chapter?: { title: string }
}

interface BookQuote {
  id: string
  text: string
  variantType: string
  variantLabel: string
  chapterId: string
  paragraphId: string
  chapterTitle: string
  chapterPosition: number
  username: string
  createdAt: string
  upvoteCount: number
  reacted: boolean
}

interface BookHighlightsPanelProps {
  authorSlug: string
  bookSlug: string
  bookId: string
  chapters: Chapter[]
}

interface SectionTone {
  accent: string
  tint: string
  border: string
  chip: string
  button: string
  buttonActive: string
  icon: string
}

interface SectionConfig {
  key: SectionKey
  order: string
  title: string
  subtitle: string
  icon: LucideIcon
  tone: SectionTone
}

const SECTION_CONFIGS: Record<SectionKey, SectionConfig> = {
  comments: {
    key: 'comments',
    order: '01',
    title: 'Комментарии',
    subtitle: 'Свежие отклики читателей',
    icon: MessageSquare,
    tone: {
      accent: 'emerald',
      tint: 'bg-emerald-50/80 dark:bg-emerald-950/25',
      border: 'border-emerald-200/70 dark:border-emerald-900/45',
      chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
      button: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50/80 dark:border-emerald-900/45 dark:text-emerald-200 dark:hover:bg-emerald-950/25',
      buttonActive: 'bg-emerald-600 text-white hover:bg-emerald-700',
      icon: 'bg-emerald-600 text-white',
    },
  },
  quotes: {
    key: 'quotes',
    order: '02',
    title: 'Цитаты',
    subtitle: 'Лучшие фрагменты книги',
    icon: MessageSquareQuote,
    tone: {
      accent: 'amber',
      tint: 'bg-amber-50/80 dark:bg-amber-950/20',
      border: 'border-amber-200/70 dark:border-amber-900/45',
      chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
      button: 'border-amber-200 text-amber-700 hover:bg-amber-50/80 dark:border-amber-900/45 dark:text-amber-200 dark:hover:bg-amber-950/25',
      buttonActive: 'bg-amber-600 text-white hover:bg-amber-700',
      icon: 'bg-amber-600 text-white',
    },
  },
  toc: {
    key: 'toc',
    order: '03',
    title: 'Содержание',
    subtitle: 'Навигация по главам',
    icon: ListOrdered,
    tone: {
      accent: 'slate',
      tint: 'bg-slate-50/80 dark:bg-slate-900/35',
      border: 'border-slate-200/80 dark:border-slate-700/60',
      chip: 'bg-slate-100 text-slate-700 dark:bg-slate-900/80 dark:text-slate-200',
      button: 'border-slate-200 text-slate-700 hover:bg-slate-50/80 dark:border-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-900/60',
      buttonActive: 'bg-slate-700 text-white hover:bg-slate-800',
      icon: 'bg-slate-700 text-white',
    },
  },
}

function sortQuotes(quotes: BookQuote[]): BookQuote[] {
  return [...quotes].sort((a, b) => {
    if (b.upvoteCount !== a.upvoteCount) return b.upvoteCount - a.upvoteCount
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин.`
  if (hours < 24) return `${hours} ч.`
  if (days < 7) return `${days} д.`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function stringToColor(str: string): string {
  let hash = 0
  for (let index = 0; index < str.length; index += 1) {
    hash = str.charCodeAt(index) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 60%, 45%)`
}

function clampParagraphStyle(lines: number): CSSProperties {
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
  }
}

function ChapterCountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-border/60">
      {count}
    </span>
  )
}

function HighlightHeader({
  config,
  count,
  active,
  onToggle,
}: {
  config: SectionConfig
  count: number
  active: boolean
  onToggle: () => void
}) {
  const Icon = config.icon

  return (
    <div className={cn('relative overflow-hidden border-b px-4 py-4 sm:px-5', config.tone.tint)}>
      <div className="pointer-events-none absolute right-4 top-2 text-5xl font-black tracking-tighter text-foreground/5 dark:text-white/5">
        {config.order}
      </div>

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm', config.tone.icon)}>
              <Icon size={16} />
            </span>
            <h3 className="text-base font-semibold text-foreground sm:text-lg">{config.title}</h3>
            <ChapterCountBadge count={count} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{config.subtitle}</p>
        </div>

        <Button
          type="button"
          size="sm"
          variant={active ? 'default' : 'outline'}
          onClick={onToggle}
          className={cn(
            'shrink-0 rounded-full px-4 shadow-none transition-all duration-200',
            active ? config.tone.buttonActive : config.tone.button,
          )}
        >
          {active ? (
            <>
              Свернуть
              <ChevronUp className="ml-1" size={14} />
            </>
          ) : (
            <>
              Развернуть
              <ChevronDown className="ml-1" size={14} />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function CommentCard({
  comment,
  chapterHref,
  expanded,
}: {
  comment: BookComment
  chapterHref: string
  expanded: boolean
}) {
  const avatarColor = stringToColor(comment.username)

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card/85 p-3 shadow-sm transition-all duration-200',
        expanded && 'p-4 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.42)]',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: avatarColor }}
        >
          {comment.username.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-foreground" style={{ color: avatarColor }}>
              {comment.username}
            </span>
            <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
            <Link
              href={chapterHref}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {comment.chapter?.title ?? 'Глава'}
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>
      <p
        className={cn('mt-3 text-sm leading-6 text-foreground/90', expanded ? 'pr-1' : 'pr-2')}
        style={clampParagraphStyle(expanded ? 4 : 2)}
      >
        {comment.body}
      </p>
    </div>
  )
}

function QuoteCard({
  quote,
  active,
  toggling,
  onToggleUpvote,
  authorSlug,
  bookSlug,
}: {
  quote: BookQuote
  active: boolean
  toggling: boolean
  onToggleUpvote: () => void
  authorSlug: string
  bookSlug: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-card to-background p-3 shadow-sm transition-all duration-200 dark:border-amber-900/45 dark:from-amber-950/20 dark:via-card dark:to-background',
        active && 'p-4 shadow-[0_16px_36px_-26px_rgba(180,83,9,0.55)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={buildQuoteReadHref(authorSlug, bookSlug, {
            chapterId: quote.chapterId,
            variantType: quote.variantType,
            paragraphId: quote.paragraphId,
          })}
          className="group min-w-0 flex-1"
          title="Открыть цитату в книге"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              {quote.variantLabel}
            </span>
            <span className="min-w-0">
              Глава {quote.chapterPosition}. {quote.chapterTitle}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 font-medium text-amber-700 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-amber-200">
              В книгу
              <ArrowUpRight size={12} />
            </span>
          </div>
          <p
            className="mt-3 text-sm leading-6 text-foreground transition-colors group-hover:text-amber-950 dark:group-hover:text-amber-100"
            style={clampParagraphStyle(active ? 4 : 2)}
          >
            «{quote.text}»
          </p>
        </Link>

        {active && (
          <Button
            type="button"
            size="sm"
            variant={quote.reacted ? 'default' : 'outline'}
            disabled={toggling}
            onClick={onToggleUpvote}
            className="shrink-0 rounded-full"
          >
            <Plus size={14} className="mr-1" />
            {quote.upvoteCount}
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          выбрал {quote.username} · {timeAgo(quote.createdAt)}
        </span>
        {!active && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
            {quote.upvoteCount}
          </span>
        )}
      </div>
    </div>
  )
}

function ChapterRow({
  chapter,
  authorSlug,
  bookSlug,
  expanded,
}: {
  chapter: Chapter
  authorSlug: string
  bookSlug: string
  expanded: boolean
}) {
  const href = `/${authorSlug}/${bookSlug}/read?chapter=${chapter.id}`

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border border-border/70 bg-card/85 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-24px_rgba(15,23,42,0.45)]',
        expanded && 'px-4 py-4',
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:text-slate-200 dark:ring-slate-700/60">
        {chapter.position + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{chapter.title}</div>
        {expanded && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            Открыть главу в режиме чтения
          </div>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5">
        {chapter.variants.length > 1 ? `${chapter.variants.length} варианта` : '1 вариант'}
        <ArrowUpRight size={12} />
      </span>
    </Link>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function LoadingStack({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-12 w-full" />
        </div>
      ))}
    </div>
  )
}

function getInitialActiveSection({
  commentCount,
  quoteCount,
  chapterCount,
}: {
  commentCount: number
  quoteCount: number
  chapterCount: number
}): SectionKey | null {
  if (commentCount > 0) return 'comments'
  if (quoteCount > 0) return 'quotes'
  if (chapterCount > 0) return 'toc'
  return null
}

export default function BookHighlightsPanel({
  authorSlug,
  bookSlug,
  bookId,
  chapters,
}: BookHighlightsPanelProps) {
  const { readerId, loadFromStorage } = useReaderStore()
  const [comments, setComments] = useState<BookComment[]>([])
  const [quotes, setQuotes] = useState<BookQuote[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [quotesError, setQuotesError] = useState<string | null>(null)
  const [manualActiveSection, setManualActiveSection] = useState<SectionKey | null>(null)
  const [hasManualSectionChoice, setHasManualSectionChoice] = useState(false)
  const [togglingQuoteId, setTogglingQuoteId] = useState<string | null>(null)

  useEffect(() => {
    if (readerId) return
    const frameId = window.requestAnimationFrame(() => {
      loadFromStorage()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [readerId, loadFromStorage])

  useEffect(() => {
    if (!bookId) return

    const controller = new AbortController()

    const fetchBookHighlights = async (): Promise<void> => {
      setCommentsLoading(true)
      setQuotesLoading(true)
      setCommentsError(null)
      setQuotesError(null)

      const commentsUrl = `/api/comments/list?${new URLSearchParams({
        bookId,
        status: 'active',
      }).toString()}`
      const quotesParams = new URLSearchParams()
      if (readerId) quotesParams.set('readerId', readerId)
      const quotesUrl = `/api/books/${bookId}/quotes${quotesParams.toString() ? `?${quotesParams.toString()}` : ''}`

      try {
        const [commentsResult, quotesResult] = await Promise.allSettled([
          fetch(commentsUrl, { signal: controller.signal }),
          fetch(quotesUrl, { signal: controller.signal }),
        ])

        if (controller.signal.aborted) return

        if (commentsResult.status === 'fulfilled' && commentsResult.value.ok) {
          const commentsData = await commentsResult.value.json()
          setComments(Array.isArray(commentsData) ? commentsData : [])
        } else {
          setComments([])
          setCommentsError('Не удалось загрузить комментарии')
        }

        if (quotesResult.status === 'fulfilled' && quotesResult.value.ok) {
          const quotesData = await quotesResult.value.json()
          setQuotes(sortQuotes(Array.isArray(quotesData.quotes) ? quotesData.quotes : []))
        } else {
          setQuotes([])
          setQuotesError('Не удалось загрузить цитаты')
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to fetch book highlights:', error)
        setComments([])
        setQuotes([])
        setCommentsError('Не удалось загрузить комментарии')
        setQuotesError('Не удалось загрузить цитаты')
      } finally {
        if (!controller.signal.aborted) {
          setCommentsLoading(false)
          setQuotesLoading(false)
        }
      }
    }

    void fetchBookHighlights()
    return () => controller.abort()
  }, [bookId, readerId])

  const visibleChapters = useMemo(() => chapters.slice(0, 3), [chapters])
  const visibleComments = useMemo(() => comments.slice(0, 3), [comments])
  const visibleQuotes = useMemo(() => quotes.slice(0, 3), [quotes])
  const contentCount = chapters.length
  const chapterCountLabel = contentCount === 1 ? 'глава' : 'глав'
  const commentCount = comments.length
  const quoteCount = quotes.length
  const preferredActiveSection = useMemo(
    () =>
      getInitialActiveSection({
        commentCount,
        quoteCount,
        chapterCount: contentCount,
      }),
    [commentCount, quoteCount, contentCount],
  )
  const activeSection = hasManualSectionChoice ? manualActiveSection : preferredActiveSection

  const handleSectionToggle = (section: SectionKey) => {
    setHasManualSectionChoice(true)
    setManualActiveSection((current) => (current === section ? null : section))
  }

  const handleToggleUpvote = async (quoteId: string): Promise<void> => {
    if (!readerId || togglingQuoteId) return

    const previousQuotes = quotes
    const optimisticQuotes = sortQuotes(
      quotes.map((quote) => {
        if (quote.id !== quoteId) return quote
        const reacted = !quote.reacted
        return {
          ...quote,
          reacted,
          upvoteCount: reacted ? quote.upvoteCount + 1 : Math.max(0, quote.upvoteCount - 1),
        }
      }),
    )

    setQuotes(optimisticQuotes)
    setTogglingQuoteId(quoteId)

    try {
      const response = await fetch(`/api/quotes/${quoteId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readerId }),
      })

      if (!response.ok) {
        setQuotes(previousQuotes)
        return
      }

      const data = await response.json()
      setQuotes((currentQuotes) =>
        sortQuotes(
          currentQuotes.map((quote) =>
            quote.id === quoteId
              ? {
                  ...quote,
                  reacted: Boolean(data.reacted),
                  upvoteCount: Number.isFinite(data.upvoteCount)
                    ? data.upvoteCount
                    : quote.upvoteCount,
                }
              : quote,
          ),
        ),
      )
    } catch (error) {
      console.error('Failed to toggle quote upvote:', error)
      setQuotes(previousQuotes)
    } finally {
      setTogglingQuoteId(null)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
      <div className="pointer-events-none absolute -right-20 top-0 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-20 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Витрина книги
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
              Комментарии, цитаты и содержание
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              «Развернуть» поднимает в фокус только один слой. Остальные остаются в компактном
              превью, чтобы страница не теряла ритм.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            {(['comments', 'quotes', 'toc'] as const).map((sectionKey) => {
              const config = SECTION_CONFIGS[sectionKey]
              const isActive = activeSection === sectionKey
              const count =
                sectionKey === 'comments' ? commentCount : sectionKey === 'quotes' ? quoteCount : contentCount

              return (
                <Button
                  key={sectionKey}
                  type="button"
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => handleSectionToggle(sectionKey)}
                  className={cn(
                    'rounded-full px-3 shadow-none',
                    isActive ? config.tone.buttonActive : config.tone.button,
                  )}
                >
                  {config.title}
                  <span className="ml-2 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold text-current dark:bg-white/10">
                    {count}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <article
            className={cn(
              'overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/90 transition-all duration-300',
              activeSection === 'comments'
                ? 'border-emerald-300/80 shadow-[0_16px_40px_-30px_rgba(16,185,129,0.45)]'
                : 'border-l-4 border-l-emerald-500',
            )}
          >
            <HighlightHeader
              config={SECTION_CONFIGS.comments}
              count={commentCount}
              active={activeSection === 'comments'}
              onToggle={() => handleSectionToggle('comments')}
            />
            {(activeSection === 'comments' || commentsLoading || commentsError || commentCount > 0) && (
              <div className="px-4 py-4 sm:px-5">
                {commentsLoading ? (
                  <LoadingStack count={3} />
                ) : commentsError ? (
                  <EmptyState text={commentsError} />
                ) : commentCount === 0 ? (
                  <EmptyState text="Пока нет активных комментариев для этой книги." />
                ) : (
                  <div className="space-y-3">
                    {visibleComments.map((comment) => (
                      <CommentCard
                        key={comment.id}
                        comment={comment}
                        chapterHref={`/${authorSlug}/${bookSlug}/read?chapter=${comment.chapterId}`}
                        expanded={activeSection === 'comments'}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </article>

          <article
            className={cn(
              'overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/90 transition-all duration-300',
              activeSection === 'quotes'
                ? 'border-amber-300/80 shadow-[0_16px_40px_-30px_rgba(245,158,11,0.45)]'
                : 'border-l-4 border-l-amber-500',
            )}
          >
            <HighlightHeader
              config={SECTION_CONFIGS.quotes}
              count={quoteCount}
              active={activeSection === 'quotes'}
              onToggle={() => handleSectionToggle('quotes')}
            />
            {(activeSection === 'quotes' || quotesLoading || quotesError || quoteCount > 0) && (
              <div className="px-4 py-4 sm:px-5">
                {quotesLoading ? (
                  <LoadingStack count={3} />
                ) : quotesError ? (
                  <EmptyState text={quotesError} />
                ) : quoteCount === 0 ? (
                  <EmptyState text="Пока никто не вынес цитаты из этой книги." />
                ) : (
                  <div className="space-y-3">
                    {visibleQuotes.map((quote) => (
                      <QuoteCard
                        key={quote.id}
                        quote={quote}
                        active={activeSection === 'quotes'}
                        toggling={togglingQuoteId === quote.id}
                        onToggleUpvote={() => void handleToggleUpvote(quote.id)}
                        authorSlug={authorSlug}
                        bookSlug={bookSlug}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </article>

          <article
            className={cn(
              'overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/90 transition-all duration-300',
              activeSection === 'toc'
                ? 'border-slate-300/80 shadow-[0_16px_40px_-30px_rgba(51,65,85,0.35)]'
                : 'border-l-4 border-l-slate-500',
            )}
          >
            <HighlightHeader
              config={SECTION_CONFIGS.toc}
              count={contentCount}
              active={activeSection === 'toc'}
              onToggle={() => handleSectionToggle('toc')}
            />
            <div className="px-4 py-4 sm:px-5">
              {contentCount === 0 ? (
                <EmptyState text="Содержание появится после загрузки глав." />
              ) : activeSection === 'toc' ? (
                <div className="space-y-3">
                  {chapters.map((chapter) => (
                    <ChapterRow
                      key={chapter.id}
                      chapter={chapter}
                      authorSlug={authorSlug}
                      bookSlug={bookSlug}
                      expanded
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleChapters.map((chapter) => (
                    <ChapterRow
                      key={chapter.id}
                      chapter={chapter}
                      authorSlug={authorSlug}
                      bookSlug={bookSlug}
                      expanded={false}
                    />
                  ))}
                  {contentCount > visibleChapters.length && (
                    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                      <Sparkles size={14} />
                      Ещё {contentCount - visibleChapters.length} {chapterCountLabel} скрыты до
                      раскрытия.
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
