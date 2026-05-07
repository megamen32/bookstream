'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, MessageSquare, ShieldOff, ShieldCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import { cn } from '@/lib/utils'
import CommentCard, { type CommentCardComment } from '@/components/comments/CommentCard'

type Comment = CommentCardComment

interface BookRoutingData {
  slug: string
  author: {
    slug: string
  }
}

type FilterStatus = 'all' | 'active' | 'shadowbanned'

const filters: Array<{ value: FilterStatus; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'shadowbanned', label: 'Скрытые' },
]

export default function CommentsPage() {
  const params = useParams()
  const bookId = params.bookId as string
  const { toast } = useToast()

  const [comments, setComments] = useState<Comment[]>([])
  const [bookRouting, setBookRouting] = useState<BookRoutingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')

  const fetchComments = useCallback(async (): Promise<void> => {
    try {
      const params = new URLSearchParams()
      params.set('bookId', bookId)
      if (filter !== 'all') params.set('status', filter)

      const res = await fetch(`/api/comments/list?${params}`)
      if (res.ok) {
        const data = await res.json()
        setComments(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoading(false)
    }
  }, [bookId, filter])

  const fetchBookRouting = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`/api/books/${bookId}`)
      if (!res.ok) {
        return
      }

      const data = await res.json() as Partial<BookRoutingData>
      if (data.slug && data.author?.slug) {
        setBookRouting({
          slug: data.slug,
          author: {
            slug: data.author.slug,
          },
        })
      }
    } catch (error) {
      console.error('Error fetching book routing:', error)
    }
  }, [bookId])

  useEffect(() => {
    const run = async () => {
      await Promise.all([fetchComments(), fetchBookRouting()])
    }
    void run()
  }, [fetchBookRouting, fetchComments])

  const handleToggleShadowban = async (comment: Comment) => {
    const newStatus = comment.status === 'shadowbanned' ? 'active' : 'shadowbanned'
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === comment.id ? { ...c, status: newStatus } : c))
        )
        toast({
          title: newStatus === 'shadowbanned' ? 'Комментарий скрыт' : 'Комментарий восстановлен',
        })
      }
    } catch {
      toast({ title: 'Ошибка обновления', variant: 'destructive' })
    }
  }

  // Group comments by chapter
  const groupedComments = comments.reduce<Record<string, Comment[]>>((acc, comment) => {
    const key = comment.chapterTitle || 'Без главы'
    if (!acc[key]) acc[key] = []
    acc[key].push(comment)
    return acc
  }, {})

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/books/${bookId}`}>
          <Button variant="ghost" size="icon" className="-ml-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Модерация комментариев
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Управление комментариями к книге
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.value)}
            className={cn(
              filter === f.value && 'bg-amber-600 hover:bg-amber-700 text-white'
            )}
          >
            {f.label}
            {f.value !== 'all' && (
              <Badge
                variant="secondary"
                className="ml-1.5 text-[10px] px-1.5 py-0"
              >
                {comments.filter((c) => c.status === f.value).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Comments */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {filter === 'all'
              ? 'Комментариев пока нет'
              : filter === 'active'
              ? 'Нет активных комментариев'
              : 'Нет скрытых комментариев'}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedComments).map(([chapterTitle, chapterComments]) => (
            <div key={chapterTitle}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <BookChapterIcon className="w-4 h-4" />
                {chapterTitle}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {chapterComments.length}
                </Badge>
              </h3>
              <div className="space-y-2">
                {chapterComments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    chapterHref={bookRouting && comment.chapterId
                      ? `/${bookRouting.author.slug}/${bookRouting.slug}/read?chapter=${comment.chapterId}`
                      : undefined}
                    chapterLabel={`Глава ${comment.chapterPosition}. ${comment.chapterTitle || 'Без главы'}`}
                    quoteHref={bookRouting && comment.chapterId && comment.quotes[0]
                      ? buildQuoteReadHref(bookRouting.author.slug, bookRouting.slug, {
                          chapterId: comment.chapterId,
                          variantType: comment.quotes[0].variantType,
                          paragraphId: comment.quotes[0].paragraphId,
                          paragraphEndId: comment.quotes[0].endParagraphId,
                          startOffset: comment.startOffset,
                          endOffset: comment.endOffset,
                        })
                      : undefined}
                    bodyLines={3}
                    className="transition-opacity"
                    action={comment.status === 'shadowbanned' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleShadowban(comment)}
                        className="h-8 text-green-600 hover:bg-green-50 hover:text-green-700"
                        title="Восстановить комментарий"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleShadowban(comment)}
                        className="h-8 text-destructive hover:bg-red-50 hover:text-destructive"
                        title="Скрыть комментарий"
                      >
                        <ShieldOff className="w-4 h-4" />
                      </Button>
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BookChapterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
