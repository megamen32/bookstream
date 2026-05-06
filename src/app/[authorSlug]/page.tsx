'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BookOpen, ArrowLeft } from 'lucide-react'

interface Author {
  id: string
  slug: string
  name: string
  bio: string | null
}

interface Book {
  id: string
  slug: string
  title: string
  description: string | null
  coverUrl: string | null
  createdAt: string
  author: { slug: string; name: string }
  _count: { chapters: number; comments: number }
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

export default function AuthorProfilePage() {
  const params = useParams()
  const authorSlug = params.authorSlug as string
  const [author, setAuthor] = useState<Author | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authorSlug) return

    async function fetchData() {
      try {
        const res = await fetch(`/api/books?authorSlug=${authorSlug}`)
        if (res.ok) {
          const data = await res.json()
          // API returns array of books with author included
          if (Array.isArray(data) && data.length > 0) {
            const firstBook = data[0]
            if (firstBook.author) {
              setAuthor({ id: firstBook.author.id, slug: firstBook.author.slug, name: firstBook.author.name, bio: null })
            }
            setBooks(data)
          }
        }
      } catch (e) {
        console.error('Failed to fetch author:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [authorSlug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-12 w-64 mb-3" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!author) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Автор не найден</h1>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            ← На главную
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          Назад
        </Link>

        {/* Author header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">{author.name}</h1>
          {author.bio && (
            <p className="text-muted-foreground text-base max-w-2xl">
              {author.bio}
            </p>
          )}
        </div>

        {/* Books grid */}
        {books.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
            <p>У автора пока нет опубликованных книг</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {books.map((book) => (
              <Link key={book.id} href={`/${author.slug}/${book.slug}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
                  {/* Cover placeholder */}
                  <div
                    className={`h-40 bg-gradient-to-br ${getGradient(book.slug)} flex items-center justify-center p-4`}
                  >
                    <h3 className="text-white font-bold text-lg text-center leading-tight">
                      {book.title}
                    </h3>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {book.description || 'Описание отсутствует'}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {book._count.chapters} {book._count.chapters === 1 ? 'глава' : 'глав'}
                      </span>
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--r-accent, #4a7c59)' }}
                      >
                        Читать →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
