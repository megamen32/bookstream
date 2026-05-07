'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useReaderStore } from '@/lib/store'
import { MessageSquareQuote, Plus } from 'lucide-react'

interface BookQuote {
  id: string
  text: string
  variantType: string
  variantLabel: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  username: string
  createdAt: string
  upvoteCount: number
  reacted: boolean
}

interface BookQuotesPanelProps {
  authorSlug: string
  bookSlug: string
  bookId: string
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

export default function BookQuotesPanel({
  authorSlug,
  bookSlug,
  bookId,
}: BookQuotesPanelProps) {
  const { readerId, loadFromStorage } = useReaderStore()
  const [quotes, setQuotes] = useState<BookQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

    const fetchQuotes = async (): Promise<void> => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (readerId) params.set('readerId', readerId)
        const query = params.toString()
        const url = query ? `/api/books/${bookId}/quotes?${query}` : `/api/books/${bookId}/quotes`
        const response = await fetch(url, { signal: controller.signal })

        if (!response.ok) {
          throw new Error('request_failed')
        }

        const data = await response.json()
        setQuotes(sortQuotes(Array.isArray(data.quotes) ? data.quotes : []))
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to fetch book quotes:', error)
        setError('Не удалось загрузить цитаты')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void fetchQuotes()
    return () => controller.abort()
  }, [bookId, readerId])

  const visibleQuotes = useMemo(() => quotes.slice(0, 12), [quotes])

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
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquareQuote size={18} className="text-amber-600" />
        <h2 className="text-lg font-semibold">Цитаты читателей</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <Card key={index}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-8 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : visibleQuotes.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Пока никто не вынес цитаты из этой книги.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleQuotes.map((quote) => (
            <Card key={quote.id} className="border-amber-100/70">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                        {quote.variantLabel}
                      </span>
                      <span>
                        Глава {quote.chapterPosition}. {quote.chapterTitle}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-foreground">
                      «{quote.text}»
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={quote.reacted ? 'default' : 'outline'}
                    size="sm"
                    disabled={!readerId || togglingQuoteId === quote.id}
                    onClick={() => void handleToggleUpvote(quote.id)}
                    className="shrink-0 rounded-full"
                  >
                    <Plus size={14} className="mr-1" />
                    {quote.upvoteCount}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    выбрал {quote.username} · {timeAgo(quote.createdAt)}
                  </span>
                  <Link
                    href={`/${authorSlug}/${bookSlug}/read?chapter=${quote.chapterId}&variant=${encodeURIComponent(quote.variantType)}`}
                    className="font-medium text-amber-700 hover:text-amber-800"
                  >
                    Открыть в книге
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
