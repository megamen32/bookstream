'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Edit,
  Eye,
  EyeOff,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import BookCoverArtwork from '@/components/book/BookCoverArtwork'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

interface Book {
  id: string
  title: string
  slug: string
  description: string | null
  coverUrl: string | null
  isPublic: boolean
  readingModeDefault: string
  createdAt: string
  author: { slug: string; name: string }
  _count: { chapters: number; comments: number }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatChapterLabel(count: number): string {
  return `${count} ${count === 1 ? 'глава' : 'глав'}`
}

export default function AdminLibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const fetchBooks = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/books?includeDrafts=1')
      if (res.ok) {
        const data = await res.json()
        setBooks(data)
      }
    } catch (error) {
      console.error('Error fetching books:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchBooks()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchBooks])

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/books/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Книга удалена' })
        setBooks((prev) => prev.filter((book) => book.id !== deleteTarget.id))
      } else {
        toast({ title: 'Ошибка удаления', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Error deleting book:', error)
      toast({ title: 'Ошибка удаления', variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
      <section className="poster-stage relative overflow-hidden rounded-[2rem] border border-slate-200/70 px-6 py-8 text-white shadow-[0_24px_90px_rgba(15,23,42,0.18)] sm:px-8">
        <div className="poster-sheen pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-white/70">
              <Sparkles size={14} className="text-amber-300" />
              Админка книг
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Список книг, статусов и действий в одном месте.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              Карточка показывает обложку, статус, количество глав и комментариев. Редактирование
              и удаление доступны прямо отсюда.
            </p>
          </div>

          <Link href="/admin/upload">
            <Button className="h-12 rounded-full bg-white px-6 text-slate-950 hover:bg-white/95">
              <Plus className="mr-2 h-4 w-4" />
              Добавить книгу
            </Button>
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="aspect-[3/4] rounded-[2rem]" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="mt-8 rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950">Библиотека пуста</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Добавьте первую книгу, и она появится здесь с обложкой, статусом и основными
            метаданными.
          </p>
          <Link href="/admin/upload" className="mt-6 inline-flex">
            <Button className="rounded-full bg-amber-500 px-6 text-white hover:bg-amber-600">
              <Plus className="mr-2 h-4 w-4" />
              Загрузить книгу
            </Button>
          </Link>
        </div>
      ) : (
        <section className="mt-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
            {books.map((book) => (
              <article
                key={book.id}
                className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(15,23,42,0.14)]"
              >
                <div className="absolute right-5 top-5 z-20">
                  <Badge
                    variant={book.isPublic ? 'default' : 'secondary'}
                    className={book.isPublic
                      ? 'border-0 bg-emerald-500 text-white hover:bg-emerald-500'
                      : 'border-0 bg-slate-950/85 text-white hover:bg-slate-950/85'
                    }
                  >
                    {book.isPublic ? (
                      <>
                        <Eye className="mr-1 h-3 w-3" />
                        Публичная
                      </>
                    ) : (
                      <>
                        <EyeOff className="mr-1 h-3 w-3" />
                        Черновик
                      </>
                    )}
                  </Badge>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] bg-slate-100">
                  <BookCoverArtwork
                    title={book.title}
                    slug={book.slug}
                    coverUrl={book.coverUrl}
                    className="aspect-[3/4] w-full"
                    titleClassName="px-6 text-2xl"
                  />
                </div>

                <div className="px-1 pb-1 pt-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    {book.author.name}
                  </p>
                  <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-tight text-slate-950">
                    {book.title}
                  </h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                    {book.description || 'Описание не задано.'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">{formatChapterLabel(book._count.chapters)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                      <MessageSquare className="h-3 w-3" />
                      {book._count.comments}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">{formatDate(book.createdAt)}</span>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 flex-1 rounded-full"
                      onClick={() => router.push(`/admin/books/${book.id}`)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Редактировать
                    </Button>
                    {book.isPublic ? (
                      <Button asChild variant="outline" size="sm" className="h-10 rounded-full px-4">
                        <Link href={`/${book.author.slug}/${book.slug}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 rounded-full px-4 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(book)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить книгу?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить «{deleteTarget?.title}»? Это действие нельзя отменить.
              Все главы и комментарии будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
