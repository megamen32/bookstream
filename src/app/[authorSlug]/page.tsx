'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react'
import BookCoverArtwork from '@/components/book/BookCoverArtwork'
import { Skeleton } from '@/components/ui/skeleton'

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

function formatChapterLabel(count: number): string {
  return `${count} ${count === 1 ? 'глава' : 'глав'}`
}

export default function AuthorProfilePage() {
  const params = useParams()
  const authorSlug = params.authorSlug as string
  const [author, setAuthor] = useState<Author | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authorSlug) return

    async function fetchData(): Promise<void> {
      try {
        const res = await fetch(`/api/books?authorSlug=${authorSlug}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            const firstBook = data[0]
            if (firstBook.author) {
              setAuthor({
                id: firstBook.author.id,
                slug: firstBook.author.slug,
                name: firstBook.author.name,
                bio: null,
              })
            }
            setBooks(data)
          }
        }
      } catch (error) {
        console.error('Failed to fetch author:', error)
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [authorSlug])

  if (loading) {
    return (
      <div className="poster-stage min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="mb-6 h-8 w-32 bg-white/10" />
          <Skeleton className="mb-3 h-12 w-80 bg-white/10" />
          <Skeleton className="mb-8 h-5 w-[32rem] max-w-full bg-white/10" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="aspect-[3/4] rounded-[2rem] bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!author) {
    return (
      <div className="poster-stage flex min-h-screen items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Автор не найден</h1>
          <Link href="/" className="text-sm text-white/60 hover:text-white">
            ← На главную
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="poster-stage min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          На главную
        </Link>

        <section className="poster-card relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 px-6 py-8 sm:px-8">
          <div className="poster-sheen pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-300">Автор</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {author.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
                {author.bio || 'Все книги автора собраны в одном каталоге.'}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-4 text-sm text-white/70">
              <div className="text-3xl font-semibold text-white">{books.length}</div>
              <div className="mt-1">книг в подборке</div>
            </div>
          </div>
        </section>

        {books.length === 0 ? (
          <div className="poster-card mt-10 rounded-[2rem] border border-white/10 px-6 py-16 text-center text-white/70">
            <BookOpen size={48} className="mx-auto mb-4 opacity-40" />
            <p className="text-lg text-white">У автора пока нет опубликованных книг</p>
          </div>
        ) : (
          <section className="mt-10">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {books.map((book) => (
                <Link
                  key={book.id}
                  href={`/${author.slug}/${book.slug}`}
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
                      <h2 className="line-clamp-2 text-lg font-semibold leading-tight text-white">
                        {book.title}
                      </h2>
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
        )}
      </div>
    </div>
  )
}
