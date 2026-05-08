'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, BookOpen, DownloadCloud, RefreshCw, Trash2 } from 'lucide-react'
import UserAreaLayout from '@/components/user/UserAreaLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  getDownloadedBooks,
  refreshDownloadedBook,
  removeDownloadedBook,
  retryOfflineSync,
  subscribeOfflineUpdates,
  syncOfflineQueue,
} from '@/lib/offline-client'
import { formatOfflineByteSize } from '@/lib/offline-helpers'
import { useReaderStore } from '@/lib/store'
import type { OfflineBookListItem } from '@/lib/offline-types'

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function OfflineBooksPage(): React.ReactElement {
  const { readerId, loadFromStorage } = useReaderStore()
  const [books, setBooks] = useState<OfflineBookListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeBookId, setActiveBookId] = useState<string | null>(null)

  useEffect(() => {
    if (readerId) return
    loadFromStorage()
  }, [readerId, loadFromStorage])

  useEffect(() => {
    let cancelled = false

    const loadBooks = async (): Promise<void> => {
      const nextBooks = await getDownloadedBooks()
      if (!cancelled) {
        setBooks(nextBooks)
        setLoading(false)
      }
    }

    void loadBooks()
    return subscribeOfflineUpdates(() => {
      void loadBooks()
    })
  }, [])

  const handleRefresh = async (book: OfflineBookListItem): Promise<void> => {
    if (!readerId) return
    setActiveBookId(book.bookId)
    try {
      await refreshDownloadedBook(book.bookId, readerId)
    } finally {
      setActiveBookId(null)
    }
  }

  const handleRemove = async (bookId: string): Promise<void> => {
    setActiveBookId(bookId)
    try {
      await removeDownloadedBook(bookId)
    } finally {
      setActiveBookId(null)
    }
  }

  const handleRetry = async (bookId: string): Promise<void> => {
    setActiveBookId(bookId)
    try {
      await retryOfflineSync(bookId)
    } finally {
      setActiveBookId(null)
    }
  }

  const handleSyncAll = async (): Promise<void> => {
    setActiveBookId('all')
    try {
      await syncOfflineQueue()
    } catch (error) {
      console.error('Failed to sync offline queue:', error)
    } finally {
      setActiveBookId(null)
    }
  }

  return (
    <UserAreaLayout
      title="Офлайн-книги"
      description="Загруженные книги, размер локального пакета и очередь офлайн-действий, которые будут синхронизированы после возврата сети."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card p-4">
          <div>
            <div className="text-sm font-medium text-foreground">Офлайн-режим</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {books.length === 0
                ? 'Здесь появятся книги, которые вы скачали для чтения без сети.'
                : `Загружено книг: ${books.length}. Очередь синка сохранится между сессиями.`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleSyncAll()}
            disabled={activeBookId === 'all' || books.length === 0}
          >
            <RefreshCw className="mr-2" size={16} />
            {activeBookId === 'all' ? 'Синхронизируем…' : 'Повторить синк'}
          </Button>
        </div>

        {loading ? (
          <Card className="rounded-3xl border-border/70">
            <CardContent className="p-6 text-sm text-muted-foreground">Загружаем офлайн-библиотеку…</CardContent>
          </Card>
        ) : books.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-border/70">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <DownloadCloud className="text-muted-foreground" size={30} />
              <div className="text-lg font-medium text-foreground">Пока нет офлайн-книг</div>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Откройте карточку книги и нажмите «Скачать офлайн», чтобы сохранить её для чтения без сети.
              </p>
            </CardContent>
          </Card>
        ) : (
          books.map((book) => (
            <Card key={book.bookId} className="rounded-3xl border-border/70">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{book.title}</h2>
                    {book.failedActions > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600">
                        <AlertCircle size={12} />
                        Ошибки: {book.failedActions}
                      </span>
                    ) : null}
                    {book.pendingActions > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700">
                        В очереди: {book.pendingActions}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{book.authorName}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Скачано: {formatDate(book.downloadedAt)}</span>
                    <span>Размер: {formatOfflineByteSize(book.estimatedSizeBytes)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/${book.authorSlug}/${book.slug}/read`}>
                    <Button type="button" variant="outline">
                      <BookOpen className="mr-2" size={16} />
                      Открыть
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleRefresh(book)}
                    disabled={activeBookId === book.bookId || !readerId}
                  >
                    <RefreshCw className="mr-2" size={16} />
                    Обновить
                  </Button>
                  {book.failedActions > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleRetry(book.bookId)}
                      disabled={activeBookId === book.bookId}
                    >
                      <DownloadCloud className="mr-2" size={16} />
                      Повторить синк
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    onClick={() => void handleRemove(book.bookId)}
                    disabled={activeBookId === book.bookId}
                  >
                    <Trash2 className="mr-2" size={16} />
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </UserAreaLayout>
  )
}
