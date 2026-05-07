'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Plus, BookOpen, Edit, Trash2, Eye, EyeOff, MessageSquare } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Book {
  id: string
  title: string
  slug: string
  description: string | null
  isPublic: boolean
  readingModeDefault: string
  createdAt: string
  _count: { chapters: number; comments: number }
}

const gradients = [
  'from-amber-400 to-orange-500',
  'from-orange-400 to-red-400',
  'from-yellow-400 to-amber-500',
  'from-rose-400 to-pink-500',
  'from-amber-500 to-yellow-400',
  'from-orange-500 to-amber-400',
]

function getGradient(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return gradients[Math.abs(hash) % gradients.length]
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function AdminLibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch('/api/books')
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
    const run = async () => {
      await fetchBooks()
    }
    void run()
  }, [fetchBooks])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/books/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Книга удалена' })
        setBooks((prev) => prev.filter((b) => b.id !== deleteTarget.id))
      }
    } catch {
      toast({ title: 'Ошибка удаления', variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Библиотека</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управление вашими книгами и главами
          </p>
        </div>
        <Link href="/admin/upload">
          <Button className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md">
            <Plus className="w-4 h-4 mr-2" />
            Добавить книгу
          </Button>
        </Link>
      </div>

      {/* Book Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : books.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Библиотека пуста</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Загрузите первую книгу, чтобы начать работу с платформой Bookstream
          </p>
          <Link href="/admin/upload">
            <Button className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Загрузить книгу
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => (
            <Card
              key={book.id}
              className="overflow-hidden group hover:shadow-lg transition-shadow border border-gray-200"
            >
              {/* Cover gradient placeholder */}
              <div
                className={`h-36 bg-gradient-to-br ${getGradient(book.id)} relative flex items-center justify-center`}
              >
                <BookOpen className="w-12 h-12 text-white/80" />
                <div className="absolute top-3 right-3 flex gap-1.5">
                  <Badge
                    variant={book.isPublic ? 'default' : 'secondary'}
                    className={book.isPublic
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-white/90 text-gray-700 hover:bg-white/95'
                    }
                  >
                    {book.isPublic ? (
                      <><Eye className="w-3 h-3 mr-1" /> Публичная</>
                    ) : (
                      <><EyeOff className="w-3 h-3 mr-1" /> Черновик</>
                    )}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-base line-clamp-1">{book.title}</h3>
                  {book.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {book.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {book._count.chapters} {book._count.chapters === 1 ? 'глава' : 'глав'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {book._count.comments}
                  </span>
                  <span>{formatDate(book.createdAt)}</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => router.push(`/admin/books/${book.id}`)}
                  >
                    <Edit className="w-3 h-3 mr-1.5" />
                    Редактировать
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(book)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
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
