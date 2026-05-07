'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Sparkles, UserRound } from 'lucide-react'
import BookCoverArtwork from '@/components/book/BookCoverArtwork'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

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

function formatChapterLabel(count: number): string {
  return `${count} ${count === 1 ? 'глава' : 'глав'}`
}

export default function HomePage() {
  const [books, setBooks] = useState<Book[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData(): Promise<void> {
      try {
        const res = await fetch('/api/books')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setBooks(data)

            const authorMap = new Map<string, Author>()
            data.forEach((book: Book) => {
              authorMap.set(book.author.slug, {
                id: book.author.id,
                slug: book.author.slug,
                name: book.author.name,
              })
            })
            setAuthors(Array.from(authorMap.values()))
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [])

  return (
    <div className="poster-stage min-h-screen text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <BookOpen size={24} className="text-amber-300" />
            <h1 className="text-xl font-semibold uppercase tracking-[0.18em]">Bookstream</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/60 sm:inline">Каталог книг</span>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-2 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/me/annotations">
                <UserRound size={16} />
                Профиль
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">


        {loading ? (
          <div className="mt-10">
            <Skeleton className="mb-5 h-6 w-40 bg-white/10" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="aspect-[3/4] rounded-[2rem] bg-white/10" />
              ))}
            </div>
          </div>
        ) : books.length > 0 ? (
          <>
            <section className="mt-10">
              <div className="mb-5">
                <h3 className="text-2xl font-semibold text-white">Последние книги</h3>
                <p className="mt-1 text-sm text-white/60">
                  Новые книги показываются с обложкой, автором и кратким описанием.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {books.map((book) => (
                  <Link
                    key={book.id}
                    href={`/${book.author.slug}/${book.slug}`}
                    className="group block h-full"
                  >
                    <article className="poster-card h-full rounded-[2rem] border border-white/10 p-3 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10">
                      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/25">
                        <div className="poster-sheen pointer-events-none absolute inset-0 z-10 opacity-60" />
                        <div className="absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                        <BookCoverArtwork
                          title={book.title}
                          slug={book.slug}
                          coverUrl={book.coverUrl}
                          className="aspect-[3/4] w-full"
                          titleClassName="px-6 text-2xl"
                        />
                      </div>

                      <div className="px-1 pb-1 pt-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/50">
                          {book.author.name}
                        </p>
                        <h4 className="mt-2 line-clamp-2 text-lg font-semibold leading-tight text-white">
                          {book.title}
                        </h4>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/60">
                          {book.description || 'Описание не указано.'}
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                          <span className="text-white/48">{formatChapterLabel(book._count.chapters)}</span>
                          <span className="inline-flex items-center gap-2 font-medium text-amber-300 transition group-hover:text-amber-200">
                            Открыть
                            <ArrowRight size={16} />
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
            <section className="poster-card relative overflow-hidden rounded-[2rem] border border-white/10 px-6 py-10 sm:px-8 lg:px-10">
              <div className="poster-sheen pointer-events-none absolute inset-0 opacity-70" />
              <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-end">
                <div className="max-w-3xl">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-white/70">
                    <Sparkles size={14} className="text-amber-300" />
                    Главная
                  </div>
                  <h2 className="max-w-2xl text-4xl font-semibold leading-none tracking-tight text-white sm:text-5xl lg:text-6xl">
                    Make Books Great Again.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                    Читай и Общайся
                  </p>
                </div>

                <div className="grid gap-3 text-sm text-white/80 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                    <div className="text-2xl font-semibold text-white">{books.length}</div>
                    <div className="mt-1 text-white/60">книг в каталоге</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                    <div className="text-2xl font-semibold text-white">{authors.length}</div>
                    <div className="mt-1 text-white/60">авторов</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                    <div className="text-2xl font-semibold text-white">3 режима</div>
                    <div className="mt-1 text-white/60">чтения и работы с текстом</div>
                  </div>
                </div>
              </div>
            </section>

            {authors.length > 0 && (
              <section className="mt-12">
                <div className="poster-card rounded-[2rem] border border-white/10 p-6 sm:p-8">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-2xl font-semibold text-white">Авторы</h3>
                      <p className="mt-1 text-sm text-white/60">
                        Быстрый переход к книгам конкретного автора.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {authors.map((author) => (
                        <Link key={author.id} href={`/${author.slug}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-white/12 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                          >
                            {author.name}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="poster-card mt-10 rounded-[2rem] border border-white/10 px-6 py-16 text-center text-white/70">
            <BookOpen size={48} className="mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium text-white">Пока нет опубликованных книг</p>
            <p className="mt-2 text-sm text-white/60">Когда книги появятся, они отобразятся здесь.</p>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-white/50 sm:px-6 lg:px-8">
          Bookstream
        </div>
      </footer>
    </div>
  )
}
