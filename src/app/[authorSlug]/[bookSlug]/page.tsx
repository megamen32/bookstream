'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, BookOpen, MessageSquare } from 'lucide-react'

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
  author: Author
  chapters: Chapter[]
  _count: { comments: number }
}

const GRADIENT_COLORS = [
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-sky-500 to-cyan-600',
  'from-lime-500 to-green-600',
]

function getGradient(slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash)
  }
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length]
}

export default function BookCoverPage() {
  const params = useParams()
  const authorSlug = params.authorSlug as string
  const bookSlug = params.bookSlug as string
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authorSlug || !bookSlug) return

    async function fetchData() {
      try {
        const res = await fetch(`/api/books/${bookSlug}?authorSlug=${authorSlug}`)
        if (res.ok) {
          const data = await res.json()
          setBook(data)
        }
      } catch (e) {
        console.error('Failed to fetch book:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [authorSlug, bookSlug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-64 rounded-2xl mb-6" />
          <Skeleton className="h-10 w-40 mb-6" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Книга не найдена</h1>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            ← На главную
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href={`/${authorSlug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          {book.author.name}
        </Link>

        {/* Book cover */}
        <div
          className={`h-64 sm:h-80 rounded-2xl bg-gradient-to-br ${getGradient(book.slug)} flex items-center justify-center p-6 mb-6 shadow-lg`}
        >
          <h1 className="text-white font-bold text-3xl sm:text-4xl text-center leading-tight">
            {book.title}
          </h1>
        </div>

        {/* Book info */}
        <div className="mb-8">
          <p className="text-lg font-semibold mb-1">{book.title}</p>
          <p className="text-sm text-muted-foreground mb-4">
            {book.author.name} · {book.chapters.length} {book.chapters.length === 1 ? 'глава' : 'глав'}
            {book._count.comments > 0 && (
              <>
                {' · '}
                <span className="inline-flex items-center gap-1">
                  <MessageSquare size={12} />
                  {book._count.comments}
                </span>
              </>
            )}
          </p>
          {book.description && (
            <p className="text-muted-foreground leading-relaxed">
              {book.description}
            </p>
          )}
        </div>

        {/* Read button */}
        <Link href={`/${authorSlug}/${bookSlug}/read`}>
          <Button
            size="lg"
            className="w-full text-base font-semibold mb-8"
            style={{
              minHeight: '52px',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--r-accent, #4a7c59)',
              color: 'var(--r-accent-foreground, #fff)',
            }}
          >
            <BookOpen className="mr-2" size={20} />
            Читать
          </Button>
        </Link>

        {/* Chapter list */}
        {book.chapters.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Содержание</h2>
            <div className="flex flex-col gap-2">
              {book.chapters.map((chapter) => (
                <Link key={chapter.id} href={`/${authorSlug}/${bookSlug}/read?chapter=${chapter.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-8 text-right flex-shrink-0">
                        {chapter.position}.
                      </span>
                      <span className="text-sm font-medium">{chapter.title}</span>
                      <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                        {chapter.variants.length > 1
                          ? `${chapter.variants.length} варианта`
                          : '1 вариант'}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
