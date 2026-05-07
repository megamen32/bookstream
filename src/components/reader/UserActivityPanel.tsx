'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { useReaderStore } from '@/lib/store'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buildQuoteReadHref } from '@/lib/quote-navigation'

type ActivityKind = 'all' | 'quotes' | 'comments' | 'reactions'

interface ActivityQuoteItem {
  id: string
  createdAt: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  commentId: string
  commentBody: string
  variantType: string
  paragraphId: string
  endParagraphId: string | null
  selectedText: string
}

interface ActivityCommentItem {
  id: string
  createdAt: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  body: string
  quoteCount: number
  quoteText: string | null
  quoteParagraphId: string | null
  quoteEndParagraphId: string | null
  quoteVariantType: string | null
}

interface ActivityReactionItem {
  id: string
  createdAt: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  paragraphId: string
  endParagraphId: string | null
  selectedText: string | null
  emoji: string
  variantType: string
}

interface ReaderActivityPayload {
  quotes: ActivityQuoteItem[]
  comments: ActivityCommentItem[]
  reactions: ActivityReactionItem[]
}

interface ActivityBase {
  id: string
  createdAt: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  kind: Exclude<ActivityKind, 'all'>
}

interface QuoteActivity extends ActivityBase {
  kind: 'quotes'
  commentBody: string
  variantType: string
  paragraphId: string
  endParagraphId: string | null
  selectedText: string
}

interface CommentActivity extends ActivityBase {
  kind: 'comments'
  body: string
  quoteText: string | null
  quoteParagraphId: string | null
  quoteEndParagraphId: string | null
  quoteCount: number
  quoteVariantType: string | null
}

interface ReactionActivity extends ActivityBase {
  kind: 'reactions'
  paragraphId: string
  endParagraphId: string | null
  selectedText: string | null
  emoji: string
  variantType: string
}

type ActivityItem = QuoteActivity | CommentActivity | ReactionActivity

interface UserActivityPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookId: string
  bookTitle?: string
  authorSlug: string
  bookSlug: string
}

const VARIANT_LABELS: Record<string, string> = {
  original: 'Оригинал',
  clean: 'Без воды',
  essence: 'Суть',
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

function formatVariantLabel(variantType: string): string {
  return VARIANT_LABELS[variantType] || variantType.charAt(0).toUpperCase() + variantType.slice(1)
}

function scopeLabel(paragraphId: string, endParagraphId: string | null): string {
  if (!endParagraphId || endParagraphId === paragraphId) {
    return '1 абзац'
  }
  return 'несколько абзацев'
}

function truncate(text: string, maxLength: number): string {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 1)}…`
}

function sortByDate(items: ActivityItem[]): ActivityItem[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function renderQuoteLink(
  authorSlug: string,
  bookSlug: string,
  item: {
    chapterId: string
    paragraphId: string
    endParagraphId: string | null
    variantType: string
  },
  children: React.ReactNode,
) {
  return (
    <Link
      href={buildQuoteReadHref(authorSlug, bookSlug, {
        chapterId: item.chapterId,
        variantType: item.variantType,
        paragraphId: item.paragraphId,
        paragraphEndId: item.endParagraphId,
      })}
      className="block rounded-2xl border border-transparent bg-[color:var(--r-bg-secondary)] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--r-border)] hover:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.32)]"
    >
      {children}
    </Link>
  )
}

function ActivityCard({
  item,
  authorSlug,
  bookSlug,
}: {
  item: ActivityItem
  authorSlug: string
  bookSlug: string
}): React.ReactElement {
  const headerMeta = `${item.chapterPosition}. ${item.chapterTitle}`

  if (item.kind === 'quotes') {
    return renderQuoteLink(authorSlug, bookSlug, item, (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
            {formatVariantLabel(item.variantType)}
          </span>
          <span>{headerMeta}</span>
          <span className="ml-auto text-[color:var(--r-accent)]">{scopeLabel(item.paragraphId, item.endParagraphId)}</span>
        </div>
        <p className="text-sm leading-6 text-foreground">«{item.selectedText}»</p>
        <div className="text-xs text-muted-foreground">
          Вы добавили цитату в комментарий · {timeAgo(item.createdAt)}
        </div>
        <p className="text-xs text-muted-foreground">
          Комментарий: {truncate(item.commentBody, 120)}
        </p>
      </div>
    ))
  }

  if (item.kind === 'comments') {
    const content = (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center rounded-full bg-[color:color-mix(in_srgb,var(--r-accent)_12%,transparent)] px-2 py-0.5 font-medium text-[color:var(--r-accent)]">
            Комментарий
          </span>
          <span>{headerMeta}</span>
          <span className="ml-auto">{timeAgo(item.createdAt)}</span>
        </div>
        <p className="text-sm leading-6 text-foreground">{item.body}</p>
        {item.quoteText && (
          <div className="rounded-xl border border-[color:var(--r-border)] bg-[color:var(--r-bg)] px-3 py-2 text-sm text-[color:var(--r-text-secondary)]">
            <span className="mr-2 inline-flex items-center rounded-full bg-[color:color-mix(in_srgb,var(--r-accent)_12%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--r-accent)]">
              Цитата
            </span>
            {truncate(item.quoteText, 160)}
          </div>
        )}
      </div>
    )

    if (item.quoteParagraphId) {
      return renderQuoteLink(
        authorSlug,
        bookSlug,
        {
          chapterId: item.chapterId,
          paragraphId: item.quoteParagraphId,
          endParagraphId: item.quoteEndParagraphId,
          variantType: item.quoteVariantType || 'original',
        },
        content,
      )
    }

    return (
      <div className="rounded-2xl border border-[color:var(--r-border)] bg-[color:var(--r-bg-secondary)] p-3">
        {content}
      </div>
    )
  }

  const reactionContent = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center rounded-full bg-[color:color-mix(in_srgb,var(--r-accent)_12%,transparent)] px-2 py-0.5 text-base leading-none">
          {item.emoji}
        </span>
        <span>Реакция</span>
        <span>{headerMeta}</span>
        <span className="ml-auto">{timeAgo(item.createdAt)}</span>
      </div>
      {item.selectedText ? (
        <p className="text-sm leading-6 text-foreground">«{truncate(item.selectedText, 180)}»</p>
      ) : (
        <p className="text-sm leading-6 text-foreground">Реакция на {scopeLabel(item.paragraphId, item.endParagraphId)}</p>
      )}
    </div>
  )

  return renderQuoteLink(
    authorSlug,
    bookSlug,
    {
      chapterId: item.chapterId,
      paragraphId: item.paragraphId,
      endParagraphId: item.endParagraphId,
      variantType: item.variantType,
    },
    reactionContent,
  )
}

export default function UserActivityPanel({
  open,
  onOpenChange,
  bookId,
  bookTitle,
  authorSlug,
  bookSlug,
}: UserActivityPanelProps) {
  const { readerId, loadFromStorage } = useReaderStore()
  const [payload, setPayload] = useState<ReaderActivityPayload>({ quotes: [], comments: [], reactions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ActivityKind>('all')

  useEffect(() => {
    if (readerId) return
    const frameId = window.requestAnimationFrame(() => {
      loadFromStorage()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [readerId, loadFromStorage])

  useEffect(() => {
    if (!open || !readerId || !bookId) return

    const controller = new AbortController()

    const fetchActivity = async (): Promise<void> => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          readerId,
          bookId,
        })
        const response = await fetch(`/api/readers/activity?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('request_failed')
        }

        const data = (await response.json()) as ReaderActivityPayload
        setPayload({
          quotes: Array.isArray(data.quotes) ? data.quotes : [],
          comments: Array.isArray(data.comments) ? data.comments : [],
          reactions: Array.isArray(data.reactions) ? data.reactions : [],
        })
      } catch (fetchError) {
        if (controller.signal.aborted) return
        console.error('Failed to fetch reader activity:', fetchError)
        setError('Не удалось загрузить вашу активность')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void fetchActivity()
    return () => controller.abort()
  }, [open, readerId, bookId])

  const allItems = useMemo<ActivityItem[]>(() => {
    const quotes = payload.quotes.map<QuoteActivity>((quote) => ({
      ...quote,
      kind: 'quotes',
    }))
    const comments = payload.comments.map<CommentActivity>((comment) => ({
      ...comment,
      kind: 'comments',
    }))
    const reactions = payload.reactions.map<ReactionActivity>((reaction) => ({
      ...reaction,
      kind: 'reactions',
    }))

    return sortByDate([...quotes, ...comments, ...reactions])
  }, [payload])

  const counts = {
    all: allItems.length,
    quotes: payload.quotes.length,
    comments: payload.comments.length,
    reactions: payload.reactions.length,
  }

  const visibleItems = useMemo(() => {
    if (tab === 'all') return allItems
    return allItems.filter((item) => item.kind === tab)
  }, [allItems, tab])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl"
        style={{
          maxHeight: '85vh',
          backgroundColor: 'var(--r-bg)',
          color: 'var(--r-text)',
          borderTop: '1px solid var(--r-border)',
        }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: 'var(--r-text)' }}>
            <UserRound size={18} className="inline-block mr-2" />
            Моя активность
          </SheetTitle>
          <SheetDescription style={{ color: 'var(--r-text-secondary)' }}>
            {bookTitle ? `В книге «${bookTitle}»` : 'Все реакции, цитаты и комментарии в этой книге'}
          </SheetDescription>
        </SheetHeader>

        <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: 0 }}>
          <Tabs value={tab} onValueChange={(value) => setTab(value as ActivityKind)} className="min-h-0">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Все {counts.all > 0 ? `(${counts.all})` : ''}</TabsTrigger>
              <TabsTrigger value="quotes">Цитаты {counts.quotes > 0 ? `(${counts.quotes})` : ''}</TabsTrigger>
              <TabsTrigger value="comments">Комментарии {counts.comments > 0 ? `(${counts.comments})` : ''}</TabsTrigger>
              <TabsTrigger value="reactions">Реакции {counts.reactions > 0 ? `(${counts.reactions})` : ''}</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-0 min-h-0">
              <ScrollArea style={{ maxHeight: 'calc(85vh - 11rem)', paddingRight: '0.25rem' }}>
                {loading ? (
                  <div className="space-y-3 py-2">
                    {[1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="h-24 rounded-2xl bg-[color:var(--r-bg-secondary)] animate-pulse"
                      />
                    ))}
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-[color:var(--r-border)] bg-[color:var(--r-bg-secondary)] p-4 text-sm text-[color:var(--r-text-secondary)]">
                    {error}
                  </div>
                ) : visibleItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--r-border)] bg-[color:var(--r-bg-secondary)] p-5 text-sm text-[color:var(--r-text-secondary)]">
                    Здесь пока пусто. Выделите текст, поставьте реакцию или напишите комментарий, и запись появится здесь.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleItems.map((item) => (
                      <ActivityCard
                        key={`${item.kind}-${item.id}`}
                        item={item}
                        authorSlug={authorSlug}
                        bookSlug={bookSlug}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
