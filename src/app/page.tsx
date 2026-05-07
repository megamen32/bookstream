'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import BookCoverArtwork from '@/components/book/BookCoverArtwork'
import { BookOpen, Sparkles } from 'lucide-react'

interface Author {
  id: string
  slug: string
  name: string
}

interface Book {
  id: string
  slug: string
  title: string
  description: string | null
  coverUrl: string | null
  author: { id: string; slug: string; name: string }
  _count: { chapters: number }
}

export default function HomePage() {
  const [books, setBooks] = useState<Book[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch all public books - we'll fetch from all known authors
        // In a real app, there would be a dedicated endpoint
        const res = await fetch('/api/books')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setBooks(data)
            // Extract unique authors
            const authorMap = new Map<string, Author>()
            data.forEach((b: Book) => {
              if (b.author) {
                authorMap.set(b.author.slug, { id: b.author.id, slug: b.author.slug, name: b.author.name })
              }
            })
            setAuthors(Array.from(authorMap.values()))
          }
        }
      } catch (e) {
        console.error('Failed to fetch data:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={24} className="text-emerald-600" />
            <h1 className="text-xl font-bold">Bookstream</h1>
          </div>
          <span className="text-sm text-muted-foreground">
            Платформа для чтения
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <section className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            Читайте книги<span className="text-emerald-600"> по-новому</span>
          </h2>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            Три варианта текста, комментарии к абзацам, настройки чтения и многое другое
          </p>
        </section>

        {/* Loading state */}
        {loading ? (
          <div className="mb-12">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          </div>
        ) : books.length > 0 ? (
          <>
            {/* Books grid */}
            <section className="mb-12">
              <h3 className="text-lg font-semibold mb-4">Последние книги</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {books.map((book) => (
                  <Link key={book.id} href={`/${book.author.slug}/${book.slug}`}>
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
                      <BookCoverArtwork
                        title={book.title}
                        slug={book.slug}
                        coverUrl={book.coverUrl}
                        className="h-40 p-4"
                        titleClassName="text-lg"
                      />
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">{book.author.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {book.description || 'Описание отсутствует'}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {book._count.chapters} {book._count.chapters === 1 ? 'глава' : 'глав'}
                          </span>
                          <span className="text-sm font-medium text-emerald-600">
                            Читать →
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>

            {/* Authors */}
            {authors.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-4">Авторы</h3>
                <div className="flex flex-wrap gap-2">
                  {authors.map((author) => (
                    <Link key={author.id} href={`/${author.slug}`}>
                      <Button variant="outline" size="sm">
                        {author.name}
                      </Button>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-2">Пока нет опубликованных книг</p>
            <p className="text-sm">Скоро здесь появятся первые публикации</p>
          </div>
        )}

        <section className="mt-16">
          <Card className="overflow-hidden border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Философия проекта
              </CardTitle>
              <CardDescription>
                Интерактивность, ясность и уважение к тексту.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Интерактивность — это всё.</span>{' '}
                Мы делаем книги снова живыми: читаем их в сети, делимся, обсуждаем и комментируем
                вместе, как в большом книжном клубе.
              </p>
              <p>
                Дизайн здесь не ради эффекта. Важны удобство, минимализм и интерфейс, который не
                отвлекает от текста и не перегружает лишним.
              </p>
              <p>Всё должно быть современным, быстрым и понятным с первого взгляда.</p>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Bookstream — платформа для чтения с интерактивными комментариями
        </div>
      </footer>
    </div>
  )
}
