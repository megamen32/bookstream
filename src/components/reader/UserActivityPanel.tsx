'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  MessageSquare,
  Quote,
  Sparkles,
  UserRound,
  Heart,
} from 'lucide-react'
import { useReaderStore } from '@/lib/store'
import {
  getOfflineAnnotations,
  getOfflineBookRecord,
  subscribeOfflineUpdates,
} from '@/lib/offline-client'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import { cn } from '@/lib/utils'
import {
  annotationKindLabel,
  type AnnotationKind,
  type UnifiedAnnotationItem,
} from '@/lib/annotations'

type ActivityKind = 'all' | 'quotes' | 'comments' | 'reactions'

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

function truncate(text: string, maxLength: number): string {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

function sortByDate(items: UnifiedAnnotationItem[]): UnifiedAnnotationItem[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function kindToTab(kind: AnnotationKind): Exclude<ActivityKind, 'all'> {
  if (kind === 'quote') return 'quotes'
  if (kind === 'comment') return 'comments'
  return 'reactions'
}

function kindLabel(kind: ActivityKind): string {
  if (kind === 'all') return 'Все'
  if (kind === 'quotes') return 'Цитаты'
  if (kind === 'comments') return 'Комментарии'
  return 'Реакции'
}

function kindIcon(kind: ActivityKind): React.ReactNode {
  if (kind === 'all') return <Sparkles size={14} />
  if (kind === 'quotes') return <Quote size={14} />
  if (kind === 'comments') return <MessageSquare size={14} />
  return <Heart size={14} />
}

function kindAccent(kind: AnnotationKind): string {
  if (kind === 'quote') return 'from-amber-500/14 via-amber-500/6 to-transparent border-amber-500/20'
  if (kind === 'comment') return 'from-[color:color-mix(in_srgb,var(--r-accent)_18%,transparent)] via-[color:color-mix(in_srgb,var(--r-accent)_8%,transparent)] to-transparent border-[color:color-mix(in_srgb,var(--r-accent)_18%,var(--r-border)_82%)]'
  return 'from-fuchsia-500/12 via-fuchsia-500/6 to-transparent border-fuchsia-500/20'
}

function renderAnnotationLink(
  authorSlug: string,
  bookSlug: string,
  item: UnifiedAnnotationItem,
  children: React.ReactNode,
) {
  if (!item.chapterId || !item.paragraphId) {
    return (
      <div className="rounded-2xl border border-[color:var(--r-border)] bg-[color:var(--r-bg-secondary)] p-3">
        {children}
      </div>
    )
  }

  return (
    <Link
      href={buildQuoteReadHref(authorSlug, bookSlug, {
        chapterId: item.chapterId,
        variantType: item.variantType,
        paragraphId: item.paragraphId,
        paragraphEndId: item.endParagraphId,
      })}
      className="group block rounded-[1.25rem] border border-transparent bg-[color:var(--r-bg-secondary)] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--r-border)] hover:shadow-[0_18px_34px_-24px_rgba(0,0,0,0.4)]"
    >
      {children}
    </Link>
  )
}

function AnnotationCard({
  item,
  authorSlug,
  bookSlug,
}: {
  item: UnifiedAnnotationItem
  authorSlug: string
  bookSlug: string
}): React.ReactElement {
  const headerMeta = `${item.chapterPosition}. ${item.chapterTitle}`

  if (item.kind === 'quote') {
    return renderAnnotationLink(authorSlug, bookSlug, item, (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-200 dark:text-amber-100">
            {formatVariantLabel(item.variantType)}
          </span>
          <span className="inline-flex items-center rounded-full border border-[color:var(--r-border)] bg-[color:var(--r-bg)] px-2.5 py-1 font-medium text-[color:var(--r-text-secondary)]">
            {headerMeta}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-[color:var(--r-text-secondary)]">
            <ArrowUpRight size={12} />
            Цитата
          </span>
        </div>
        <p className="text-[15px] leading-7 text-[color:var(--r-text)]">«{item.selectedText || ''}»</p>
        {item.body && (
          <p className="text-sm leading-6 text-[color:var(--r-text-secondary)]">
            {truncate(item.body, 120)}
          </p>
        )}
        <div className="text-xs text-[color:var(--r-text-secondary)]">
          Вы вынесли цитату · {timeAgo(item.createdAt)}
        </div>
      </div>
    ))
  }

  if (item.kind === 'comment') {
    const content = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_srgb,var(--r-accent)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--r-accent)_12%,transparent)] px-2.5 py-1 font-medium text-[color:var(--r-accent)]">
            {annotationKindLabel('comment')}
          </span>
          <span className="inline-flex items-center rounded-full border border-[color:var(--r-border)] bg-[color:var(--r-bg)] px-2.5 py-1 font-medium text-[color:var(--r-text-secondary)]">
            {headerMeta}
          </span>
          <span className="ml-auto">{timeAgo(item.createdAt)}</span>
        </div>
        <p className="text-[15px] leading-7 text-[color:var(--r-text)]">{item.body || ''}</p>
        {item.selectedText && (
          <div className="rounded-2xl border border-[color:var(--r-border)] bg-[color:var(--r-bg)] px-3 py-2.5 text-sm text-[color:var(--r-text-secondary)]">
            <span className="mr-2 inline-flex items-center rounded-full bg-[color:color-mix(in_srgb,var(--r-accent)_12%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--r-accent)]">
              Цитата
            </span>
            {truncate(item.selectedText, 160)}
          </div>
        )}
      </div>
    )

    return item.paragraphId
      ? renderAnnotationLink(authorSlug, bookSlug, item, content)
      : (
          <div className="rounded-2xl border border-[color:var(--r-border)] bg-[color:var(--r-bg-secondary)] p-3">
            {content}
          </div>
        )
  }

  const reactionContent = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_srgb,var(--r-accent)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--r-accent)_12%,transparent)] px-2.5 py-1 text-base leading-none">
          {item.emoji || '•'}
        </span>
        <span className="inline-flex items-center rounded-full border border-[color:var(--r-border)] bg-[color:var(--r-bg)] px-2.5 py-1 font-medium text-[color:var(--r-text-secondary)]">
          {annotationKindLabel('reaction')}
        </span>
        <span className="inline-flex items-center rounded-full border border-[color:var(--r-border)] bg-[color:var(--r-bg)] px-2.5 py-1 font-medium text-[color:var(--r-text-secondary)]">
          {headerMeta}
        </span>
        <span className="ml-auto">{timeAgo(item.createdAt)}</span>
      </div>
      {item.selectedText ? (
        <p className="text-[15px] leading-7 text-[color:var(--r-text)]">«{truncate(item.selectedText, 180)}»</p>
      ) : (
        <p className="text-[15px] leading-7 text-[color:var(--r-text)]">Реакция на фрагмент текста</p>
      )}
    </div>
  )

  return renderAnnotationLink(authorSlug, bookSlug, item, reactionContent)
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
  const [items, setItems] = useState<UnifiedAnnotationItem[]>([])
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
        const offlineRecord = await getOfflineBookRecord(bookId)
        if (offlineRecord) {
          const offlineItems = await getOfflineAnnotations({
            bookId,
            readerId,
          })
          if (!controller.signal.aborted) {
            setItems(sortByDate(offlineItems))
            setLoading(false)
          }
          return
        }

        const params = new URLSearchParams({
          readerId,
          bookId,
        })
        const response = await fetch(`/api/annotations?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('request_failed')
        }

        const data = await response.json() as { annotations?: UnifiedAnnotationItem[] }
        setItems(sortByDate(Array.isArray(data.annotations) ? data.annotations : []))
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
    const unsubscribe = subscribeOfflineUpdates(() => {
      void fetchActivity()
    })
    return () => {
      controller.abort()
      unsubscribe()
    }
  }, [open, readerId, bookId])

  const counts = useMemo(() => ({
    all: items.length,
    quotes: items.filter((item) => item.kind === 'quote').length,
    comments: items.filter((item) => item.kind === 'comment').length,
    reactions: items.filter((item) => item.kind === 'reaction').length,
  }), [items])

  const visibleItems = useMemo(() => {
    if (tab === 'all') return items
    return items.filter((item) => kindToTab(item.kind) === tab)
  }, [items, tab])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="reader-sheet reader-sheet--bottom reader-activity-sheet !gap-0 !overflow-hidden !rounded-t-[1.75rem] !border-t-[color:color-mix(in_srgb,var(--r-border)_78%,transparent)]"
        style={{
          height: '85vh',
          maxHeight: '85vh',
          backgroundColor: 'var(--r-bg)',
          color: 'var(--r-text)',
        }}
      >
        <SheetHeader className="relative border-b border-[color:var(--r-border)] px-4 pb-4 pt-5 sm:px-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,_color-mix(in_srgb,var(--r-accent)_18%,transparent),_transparent_70%)] opacity-70" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--r-border)] bg-[color:color-mix(in_srgb,var(--r-accent)_10%,var(--r-bg)_90%)] text-[color:var(--r-accent)] shadow-[0_16px_30px_-24px_rgba(0,0,0,0.6)]">
              <UserRound size={18} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <SheetTitle className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[color:var(--r-text)]">
                Моя активность
              </SheetTitle>
              <SheetDescription className="text-sm text-[color:var(--r-text-secondary)]">
                {bookTitle ? `В книге «${bookTitle}»` : 'Все реакции, цитаты и комментарии в этой книге'}
              </SheetDescription>
            </div>
          </div>

        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
          <div className="overflow-x-auto pb-1">
            <div className="inline-flex min-w-full gap-2 rounded-[1.15rem] border border-[color:var(--r-border)] bg-[color:color-mix(in_srgb,var(--r-bg-secondary)_72%,transparent)] p-1.5">
              {(['all', 'quotes', 'comments', 'reactions'] as ActivityKind[]).map((itemKind) => {
                const active = tab === itemKind
                const count = counts[itemKind]

                return (
                  <button
                    key={itemKind}
                    type="button"
                    onClick={() => setTab(itemKind)}
                    className={cn(
                      'inline-flex min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-[0.95rem] border px-3 py-2 text-sm font-medium transition-all duration-200 sm:min-w-0 sm:flex-none',
                      active
                        ? 'border-[color:color-mix(in_srgb,var(--r-accent)_34%,var(--r-border)_66%)] bg-[color:color-mix(in_srgb,var(--r-accent)_16%,var(--r-bg)_84%)] text-[color:var(--r-text)] shadow-[0_14px_30px_-24px_rgba(0,0,0,0.58)]'
                        : 'border-transparent bg-transparent text-[color:var(--r-text-secondary)] hover:border-[color:var(--r-border)] hover:bg-[color:var(--r-bg)] hover:text-[color:var(--r-text)]',
                    )}
                  >
                    <span className={cn('inline-flex items-center justify-center', active ? 'text-[color:var(--r-accent)]' : 'text-current')}>
                      {kindIcon(itemKind)}
                    </span>
                    <span className="whitespace-nowrap">{kindLabel(itemKind)}</span>
                    <span className={cn(
                      'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                      active
                        ? 'bg-[color:color-mix(in_srgb,var(--r-accent)_18%,transparent)] text-[color:var(--r-accent)]'
                        : 'bg-[color:var(--r-bg-secondary)] text-[color:var(--r-text-secondary)]',
                    )}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <ScrollArea className="min-h-0 h-full flex-1" style={{ paddingRight: '0.25rem' }}>
            {loading ? (
              <div className="space-y-3 py-1">
                {[1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="h-28 rounded-[1.25rem] border border-[color:var(--r-border)] bg-[color:var(--r-bg-secondary)]/90 animate-pulse"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-[1.25rem] border border-[color:var(--r-border)] bg-[color:var(--r-bg-secondary)] p-4 text-sm text-[color:var(--r-text-secondary)]">
                {error}
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-[color:var(--r-border)] bg-[color:var(--r-bg-secondary)] p-5 text-sm text-[color:var(--r-text-secondary)]">
                <div className="flex items-center gap-2 text-[color:var(--r-text)]">
                  <Sparkles size={16} className="text-[color:var(--r-accent)]" />
                  Пока здесь пусто
                </div>
                <p className="mt-2 leading-6">
                  Когда вы оставите цитату, комментарий или реакцию, они появятся здесь как личная лента чтения.
                </p>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'overflow-hidden rounded-[1.4rem] border bg-gradient-to-br p-1',
                      kindAccent(item.kind),
                    )}
                  >
                    <div className="rounded-[1.2rem] bg-[color:color-mix(in_srgb,var(--r-bg)_96%,transparent)] p-0.5">
                      <AnnotationCard
                        item={item}
                        authorSlug={authorSlug}
                        bookSlug={bookSlug}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
