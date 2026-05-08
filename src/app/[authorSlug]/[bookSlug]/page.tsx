'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, BookOpen, Download, MessageSquare, RefreshCw, Trash2 } from 'lucide-react'
import BookCoverArtwork from '@/components/book/BookCoverArtwork'
import BookHighlightsPanel from '@/components/book/BookHighlightsPanel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useReaderStore } from '@/lib/store'
import {
  downloadBook,
  getOfflineBookBySlugs,
  refreshDownloadedBook,
  removeDownloadedBook,
  subscribeOfflineUpdates,
} from '@/lib/offline-client'

interface Author {
  id: string
  slug: string
  name: string
  bio: string | null
}

interface Chapter {
  id: string
  title: string
  position: number
  variants: Array<{ id: string; variantType: string }>
}

interface Book {
  id: string
  slug: string
  title: string
  description: string | null
  coverUrl: string | null
  openStatsPublic: boolean
  author: Author
  chapters: Chapter[]
  _count: { comments: number }
}

interface PublicBookStats {
  book: {
    uniqueReaders: number
    totalReadSeconds: number
    avgReadSeconds: number
    avgProgressPercent: number
    completionRatePercent: number
  }
}

function formatChapterLabel(count: number): string {
  return `${count} ${count === 1 ? 'глава' : 'глав'}`
}

function formatDurationLabel(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours} ч ${minutes} мин`
  }

  return `${minutes} мин`
}

export default function BookCoverPage() {
  const params = useParams()
  const authorSlug = params.authorSlug as string
  const bookSlug = params.bookSlug as string
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloaded, setDownloaded] = useState(false)
  const [downloadPending, setDownloadPending] = useState(false)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [stats, setStats] = useState<PublicBookStats | null>(null)
  const { readerId, loadFromStorage } = useReaderStore()

  useEffect(() => {
    if (!authorSlug || !bookSlug) return

    async function fetchData(): Promise<void> {
      try {
        const res = await fetch(`/api/books/${bookSlug}?authorSlug=${authorSlug}`)
        if (res.ok) {
          const data = await res.json() as Book
          setBook(data)

          if (data.openStatsPublic) {
            const statsRes = await fetch(`/api/books/${data.id}/stats`)
            if (statsRes.ok) {
              const statsData = await statsRes.json() as PublicBookStats
              setStats(statsData)
            }
          } else {
            setStats(null)
          }
        }
      } catch (error) {
        console.error('Failed to fetch book:', error)
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [authorSlug, bookSlug])

  useEffect(() => {
    if (readerId) return
    loadFromStorage()
  }, [readerId, loadFromStorage])

  useEffect(() => {
    let isCancelled = false

    const loadOfflineState = async (): Promise<void> => {
      const offlineRecord = await getOfflineBookBySlugs(authorSlug, bookSlug)
      if (!isCancelled) {
        setDownloaded(Boolean(offlineRecord))
      }
    }

    void loadOfflineState()

    return subscribeOfflineUpdates(() => {
      void loadOfflineState()
    })
  }, [authorSlug, bookSlug])

  const handleDownload = async (): Promise<void> => {
    if (!book || !readerId) return

    setDownloadPending(true)
    setOfflineError(null)
    try {
      await downloadBook(book.id, readerId)
      setDownloaded(true)
    } catch (error) {
      console.error('Failed to download book for offline:', error)
      setOfflineError('Не удалось сохранить книгу офлайн.')
    } finally {
      setDownloadPending(false)
    }
  }

  const handleRefresh = async (): Promise<void> => {
    if (!book || !readerId) return

    setDownloadPending(true)
    setOfflineError(null)
    try {
      await refreshDownloadedBook(book.id, readerId)
      setDownloaded(true)
    } catch (error) {
      console.error('Failed to refresh offline book:', error)
      setOfflineError('Не удалось обновить офлайн-копию.')
    } finally {
      setDownloadPending(false)
    }
  }

  const handleRemove = async (): Promise<void> => {
    if (!book) return

    setDownloadPending(true)
    setOfflineError(null)
    try {
      await removeDownloadedBook(book.id)
      setDownloaded(false)
    } catch (error) {
      console.error('Failed to remove offline book:', error)
      setOfflineError('Не удалось удалить офлайн-копию.')
    } finally {
      setDownloadPending(false)
    }
  }

  if (loading) {
    return (
      <div className="poster-stage min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Skeleton className="mb-8 h-8 w-32 bg-white/10" />
          <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-center">
            <Skeleton className="aspect-[3/4] rounded-[2.25rem] bg-white/10" />
            <div>
              <Skeleton className="h-14 w-4/5 bg-white/10" />
              <Skeleton className="mt-4 h-5 w-64 bg-white/10" />
              <Skeleton className="mt-8 h-14 w-full max-w-xs rounded-full bg-white/10" />
              <Skeleton className="mt-6 h-24 w-full rounded-[1.5rem] bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="poster-stage flex min-h-screen items-center justify-center text-white">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold">Книга не найдена</h1>
          <Link href="/" className="text-sm text-white/60 hover:text-white">
            ← На главную
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="poster-stage min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link
          href={`/${authorSlug}`}
          className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          {book.author.name}
        </Link>

        <section className="poster-card relative mt-6 overflow-hidden rounded-[2.25rem] border border-white/10 px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="poster-sheen pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-center">
            <div className="mx-auto w-full max-w-sm">
              <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-black/25 shadow-[0_32px_90px_rgba(0,0,0,0.42)]">
                <div className="absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <BookCoverArtwork
                  title={book.title}
                  slug={book.slug}
                  coverUrl={book.coverUrl}
                  className="aspect-[3/4] w-full"
                  titleClassName="px-8 text-3xl"
                />
              </div>
            </div>

            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-300">Карточка книги</p>
              <h1 className="mt-3 text-4xl font-semibold leading-none tracking-tight text-white sm:text-5xl lg:text-6xl">
                {book.title}
              </h1>
              <p className="mt-4 text-lg text-white/70">
                {book.author.name}
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/80">
                <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">
                  {formatChapterLabel(book.chapters.length)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2">
                  <MessageSquare size={14} />
                  {book._count.comments} комментариев
                </span>
              </div>

              {book.description ? (
                <div className="mt-6 max-w-2xl rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-base leading-7 text-white/70">
                  {book.description}
                </div>
              ) : null}

              <Link href={`/${authorSlug}/${bookSlug}/read`} className="mt-8 inline-flex w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-14 min-w-[220px] rounded-full bg-white text-slate-950 shadow-[0_18px_40px_rgba(255,255,255,0.18)] hover:bg-white/95"
                >
                  <BookOpen className="mr-2" size={20} />
                  Читать книгу
                </Button>
              </Link>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {!downloaded ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => void handleDownload()}
                    disabled={downloadPending || !readerId}
                  >
                    <Download className="mr-2" size={16} />
                    {downloadPending ? 'Сохраняем офлайн…' : 'Скачать офлайн'}
                  </Button>
                ) : (
                  <>
                    <Link href={`/${authorSlug}/${bookSlug}/read`} className="inline-flex">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-emerald-400/25 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18 hover:text-white"
                      >
                        <BookOpen className="mr-2" size={16} />
                        Открыть офлайн
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white"
                      onClick={() => void handleRefresh()}
                      disabled={downloadPending || !readerId}
                    >
                      <RefreshCw className="mr-2" size={16} />
                      {downloadPending ? 'Обновляем…' : 'Обновить'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15 hover:text-white"
                      onClick={() => void handleRemove()}
                      disabled={downloadPending}
                    >
                      <Trash2 className="mr-2" size={16} />
                      Удалить
                    </Button>
                  </>
                )}
              </div>
              {offlineError ? (
                <p className="mt-3 text-sm text-rose-200">{offlineError}</p>
              ) : downloaded ? (
                <p className="mt-3 text-sm text-emerald-200">Книга доступна офлайн на этом устройстве.</p>
              ) : (
                <p className="mt-3 text-sm text-white/55">Скачайте книгу, чтобы читать её без сети и синхронизировать действия позже.</p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-black/5 bg-white p-3 text-slate-950 shadow-[0_20px_80px_rgba(15,23,42,0.2)] sm:p-5">
          {book.openStatsPublic && stats ? (
            <div className="mb-5 rounded-[1.5rem] border border-emerald-200/60 bg-emerald-50/80 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">
                    Открытая статистика
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Как читают эту книгу</h2>
                </div>
                <p className="text-sm text-slate-600">
                  Только общая картина по книге, без раскрытия статистики по главам.
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.25rem] border border-white/60 bg-white/80 p-4">
                  <div className="text-2xl font-semibold text-slate-950">{stats.book.uniqueReaders}</div>
                  <div className="mt-1 text-sm text-slate-600">читателей открыли книгу</div>
                </div>
                <div className="rounded-[1.25rem] border border-white/60 bg-white/80 p-4">
                  <div className="text-2xl font-semibold text-slate-950">
                    {formatDurationLabel(stats.book.avgReadSeconds)}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">среднее время чтения</div>
                </div>
                <div className="rounded-[1.25rem] border border-white/60 bg-white/80 p-4">
                  <div className="text-2xl font-semibold text-slate-950">{stats.book.avgProgressPercent}%</div>
                  <div className="mt-1 text-sm text-slate-600">средний прогресс</div>
                </div>
                <div className="rounded-[1.25rem] border border-white/60 bg-white/80 p-4">
                  <div className="text-2xl font-semibold text-slate-950">{stats.book.completionRatePercent}%</div>
                  <div className="mt-1 text-sm text-slate-600">дочитывают до конца</div>
                </div>
              </div>
            </div>
          ) : null}

          <BookHighlightsPanel
            authorSlug={authorSlug}
            bookSlug={bookSlug}
            bookId={book.id}
            chapters={book.chapters}
          />
        </section>
      </div>
    </div>
  )
}
