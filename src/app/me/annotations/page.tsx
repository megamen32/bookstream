'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookCopy, BookOpen, MessageSquare, Sparkles } from 'lucide-react'
import UserAreaLayout from '@/components/user/UserAreaLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import {
  getAllOfflineReaderAnnotations,
  getOfflineCatalogBooks,
  subscribeOfflineUpdates,
} from '@/lib/offline-client'
import {
  annotationKindLabel,
  type AnnotationKind,
  type UnifiedAnnotationItem,
} from '@/lib/annotations'
import { useReaderStore } from '@/lib/store'

type AnnotationFilter = 'all' | AnnotationKind

interface BookLookupItem {
  id: string
  slug: string
  title: string
  author: {
    slug: string
    name: string
  }
}

interface BookSummary {
  bookId: string
  bookTitle: string
  bookSlug: string | null
  authorSlug: string | null
  authorName: string | null
  count: number
  quoteCount: number
  commentCount: number
  reactionCount: number
  latestAt: string
}

const FILTERS: Array<{ value: AnnotationFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'quote', label: 'Цитаты' },
  { value: 'comment', label: 'Комментарии' },
  { value: 'reaction', label: 'Реакции' },
]

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

function truncate(text: string | null | undefined, maxLength: number): string {
  const normalized = (text || '').trim().replace(/\s+/g, ' ')
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1)}…`
}

function buildAnnotationHref(
  item: UnifiedAnnotationItem,
  bookMeta: BookLookupItem | undefined,
): string | null {
  if (!bookMeta) {
    return null
  }

  if (item.paragraphId) {
    return buildQuoteReadHref(bookMeta.author.slug, bookMeta.slug, {
      chapterId: item.chapterId,
      variantType: item.variantType,
      paragraphId: item.paragraphId,
      paragraphEndId: item.endParagraphId,
    })
  }

  return `/${bookMeta.author.slug}/${bookMeta.slug}/read?chapter=${item.chapterId}&variant=${item.variantType}`
}

function AnnotationFeedCard({
  item,
  bookMeta,
}: {
  item: UnifiedAnnotationItem
  bookMeta?: BookLookupItem
}): React.ReactElement {
  const href = buildAnnotationHref(item, bookMeta)
  const content = (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className="rounded-full px-2.5 py-1 font-medium"
          style={{
            backgroundColor: 'var(--user-accent-soft)',
            color: 'var(--user-accent-text)',
          }}
        >
          {annotationKindLabel(item.kind)}
        </span>
        <span>{bookMeta?.title || 'Книга'}</span>
        <span>·</span>
        <span>{item.chapterPosition}. {item.chapterTitle}</span>
        <span className="ml-auto">{timeAgo(item.createdAt)}</span>
      </div>

      {item.kind === 'quote' && (
        <div className="space-y-2">
          <p className="text-sm leading-6 text-foreground">«{truncate(item.selectedText, 220)}»</p>
          <p className="text-xs text-muted-foreground">Вариант: {item.variantType}</p>
        </div>
      )}

      {item.kind === 'comment' && (
        <div className="space-y-2">
          <p className="text-sm leading-6 text-foreground">{truncate(item.body, 220)}</p>
          {item.selectedText && (
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Цитата: {truncate(item.selectedText, 180)}
            </p>
          )}
        </div>
      )}

      {item.kind === 'reaction' && (
        <div className="space-y-2">
          <p className="text-sm leading-6 text-foreground">
            <span className="mr-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-base leading-none">
              {item.emoji || '•'}
            </span>
            {item.selectedText ? `Реакция на фрагмент «${truncate(item.selectedText, 160)}»` : 'Реакция на абзац'}
          </p>
          <p className="text-xs text-muted-foreground">Вариант: {item.variantType}</p>
        </div>
      )}
    </>
  )

  if (!href) {
    return (
      <div className="block rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
        {content}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
    >
      {content}
    </Link>
  )
}

export default function UserAnnotationsPage(): React.ReactElement {
  const { readerId, username, showCommunityAnnotations, loadFromStorage } = useReaderStore()
  const [annotations, setAnnotations] = useState<UnifiedAnnotationItem[]>([])
  const [booksById, setBooksById] = useState<Record<string, BookLookupItem>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<AnnotationFilter>('all')

  useEffect(() => {
    if (readerId) return
    loadFromStorage()
  }, [readerId, loadFromStorage])

  useEffect(() => {
    if (!readerId) return

    const controller = new AbortController()

    const fetchData = async (): Promise<void> => {
      setLoading(true)
      setError(null)

      try {
        const [offlineAnnotations, offlineBooks] = await Promise.all([
          getAllOfflineReaderAnnotations(),
          getOfflineCatalogBooks(),
        ])
        if (offlineAnnotations.length > 0 || offlineBooks.length > 0) {
          const booksMap = Object.fromEntries(
            offlineBooks.map((book) => [book.id, book]),
          ) as Record<string, BookLookupItem>

          if (!controller.signal.aborted) {
            setBooksById(booksMap)
            setAnnotations(Array.isArray(offlineAnnotations) ? offlineAnnotations.filter((item) => item.readerId === readerId) : [])
            setLoading(false)
          }

          if (navigator.onLine === false) {
            return
          }
        }

        const [annotationsResponse, booksResponse] = await Promise.all([
          fetch(`/api/annotations?readerId=${readerId}`, { signal: controller.signal }),
          fetch('/api/books', { signal: controller.signal }),
        ])

        if (!annotationsResponse.ok || !booksResponse.ok) {
          throw new Error('request_failed')
        }

        const annotationsPayload = await annotationsResponse.json() as {
          annotations?: UnifiedAnnotationItem[]
        }
        const booksPayload = await booksResponse.json() as BookLookupItem[]

        if (controller.signal.aborted) {
          return
        }

        const booksMap = Object.fromEntries(
          booksPayload.map((book) => [book.id, book]),
        ) as Record<string, BookLookupItem>

        setBooksById(booksMap)
        setAnnotations(Array.isArray(annotationsPayload.annotations) ? annotationsPayload.annotations : [])
      } catch (fetchError) {
        if (controller.signal.aborted) return
        console.error('Failed to fetch reader annotations:', fetchError)
        setError('Не удалось загрузить ваши аннотации.')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void fetchData()
    const unsubscribe = subscribeOfflineUpdates(() => {
      void fetchData()
    })
    return () => {
      controller.abort()
      unsubscribe()
    }
  }, [readerId])

  const filteredAnnotations = useMemo(() => {
    if (filter === 'all') {
      return annotations
    }

    return annotations.filter((item) => item.kind === filter)
  }, [annotations, filter])

  const bookSummaries = useMemo(() => {
    const grouped = new Map<string, BookSummary>()

    for (const item of annotations) {
      const existing = grouped.get(item.bookId)
      const bookMeta = booksById[item.bookId]

      if (existing) {
        existing.count += 1
        existing.latestAt = new Date(existing.latestAt).getTime() > new Date(item.createdAt).getTime()
          ? existing.latestAt
          : item.createdAt
        if (item.kind === 'quote') existing.quoteCount += 1
        if (item.kind === 'comment') existing.commentCount += 1
        if (item.kind === 'reaction') existing.reactionCount += 1
        continue
      }

      grouped.set(item.bookId, {
        bookId: item.bookId,
        bookTitle: bookMeta?.title || `Книга ${item.bookId}`,
        bookSlug: bookMeta?.slug || null,
        authorSlug: bookMeta?.author.slug || null,
        authorName: bookMeta?.author.name || null,
        count: 1,
        quoteCount: item.kind === 'quote' ? 1 : 0,
        commentCount: item.kind === 'comment' ? 1 : 0,
        reactionCount: item.kind === 'reaction' ? 1 : 0,
        latestAt: item.createdAt,
      })
    }

    return Array.from(grouped.values()).sort(
      (left, right) => new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime(),
    )
  }, [annotations, booksById])

  const stats = useMemo(() => ({
    total: annotations.length,
    books: bookSummaries.length,
    quotes: annotations.filter((item) => item.kind === 'quote').length,
    comments: annotations.filter((item) => item.kind === 'comment').length,
    reactions: annotations.filter((item) => item.kind === 'reaction').length,
  }), [annotations, bookSummaries.length])

  return (
    <UserAreaLayout
      title="Мои аннотации"
      description="Сводная панель по всем вашим реакциям, цитатам и комментариям во всех книгах."
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardDescription>Всего аннотаций</CardDescription>
              <CardTitle>{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardDescription>Книги</CardDescription>
              <CardTitle>{stats.books}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardDescription>Цитаты</CardDescription>
              <CardTitle>{stats.quotes}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardDescription>Комментарии</CardDescription>
              <CardTitle>{stats.comments}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardDescription>Реакции</CardDescription>
              <CardTitle>{stats.reactions}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card
          className="border-border/70"
          style={{
            background: 'linear-gradient(135deg, var(--user-accent-soft) 0%, var(--background) 58%, color-mix(in srgb, var(--user-accent) 8%, white) 100%)',
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles size={18} />
              Профиль читателя
            </CardTitle>
            <CardDescription>
              {username || 'Читатель'} · {showCommunityAnnotations ? 'в ридере видны все аннотации' : 'в ридере скрыты чужие аннотации'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/me/settings"
              className="inline-flex items-center gap-2 text-sm font-medium"
              style={{ color: 'var(--user-accent-text)' }}
            >
              Перейти в настройки
            </Link>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)]">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookCopy size={18} />
                По книгам
              </CardTitle>
              <CardDescription>
                Где у вас уже накопились заметки и реакции.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted/60" />
                  ))}
                </div>
              ) : bookSummaries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                  У вас пока нет аннотаций.
                </div>
              ) : (
                <div className="space-y-3">
                  {bookSummaries.map((summary) => {
                    const hasBookLink = summary.authorSlug && summary.bookSlug

                    return (
                      <div key={summary.bookId} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium text-foreground">{summary.bookTitle}</div>
                            <div className="text-sm text-muted-foreground">
                              {summary.authorName || 'Автор'} · обновлено {timeAgo(summary.latestAt)}
                            </div>
                          </div>
                          {hasBookLink && (
                            <Link
                              href={`/${summary.authorSlug}/${summary.bookSlug}`}
                              className="inline-flex items-center gap-1 text-sm"
                              style={{ color: 'var(--user-accent-text)' }}
                            >
                              <BookOpen size={15} />
                              Открыть
                            </Link>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full bg-background px-2.5 py-1">{summary.count} всего</span>
                          <span className="rounded-full bg-background px-2.5 py-1">{summary.quoteCount} цитат</span>
                          <span className="rounded-full bg-background px-2.5 py-1">{summary.commentCount} комментариев</span>
                          <span className="rounded-full bg-background px-2.5 py-1">{summary.reactionCount} реакций</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare size={18} />
                Лента аннотаций
              </CardTitle>
              <CardDescription>
                Последние заметки из всех книг с переходом прямо к нужному месту.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filterOption) => (
                  <Button
                    key={filterOption.value}
                    variant={filter === filterOption.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(filterOption.value)}
                  >
                    {filterOption.label}
                  </Button>
                ))}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((index) => (
                    <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted/60" />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                  {error}
                </div>
              ) : filteredAnnotations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                  Для этого фильтра пока ничего нет.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAnnotations.map((item) => (
                    <AnnotationFeedCard
                      key={item.id}
                      item={item}
                      bookMeta={booksById[item.bookId]}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </UserAreaLayout>
  )
}
