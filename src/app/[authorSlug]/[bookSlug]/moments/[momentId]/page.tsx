import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BookOpen } from 'lucide-react'
import BookCoverArtwork from '@/components/book/BookCoverArtwork'
import { Button } from '@/components/ui/button'
import {
  buildMomentReaderHref,
  buildPublicBookPath,
  buildPublicMomentPath,
} from '@/lib/public-sharing'
import { buildPublicMomentMetadata } from '@/lib/public-metadata'
import { getPublicBookMomentById } from '@/lib/public-books'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface PublicMomentPageProps {
  params: Promise<{
    authorSlug: string
    bookSlug: string
    momentId: string
  }>
}

async function loadMoment(momentId: string) {
  return getPublicBookMomentById(momentId)
}

export async function generateMetadata({ params }: PublicMomentPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const moment = await loadMoment(resolvedParams.momentId)

  if (!moment) {
    return {
      title: 'Цитата не найдена',
    }
  }

  return buildPublicMomentMetadata(moment)
}

export default async function PublicMomentPage({ params }: PublicMomentPageProps): Promise<ReactElement> {
  const resolvedParams = await params
  const moment = await loadMoment(resolvedParams.momentId)

  if (!moment) {
    notFound()
  }

  if (moment.authorSlug !== resolvedParams.authorSlug || moment.bookSlug !== resolvedParams.bookSlug) {
    redirect(buildPublicMomentPath(moment.authorSlug, moment.bookSlug, moment.id))
  }

  const readerHref = buildMomentReaderHref(moment)
  const bookPath = buildPublicBookPath(moment.authorSlug, moment.bookSlug)

  return (
    <div className="poster-stage min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link
          href={bookPath}
          className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          {moment.book.author.name}
        </Link>

        <section className="poster-card relative mt-6 overflow-hidden rounded-[2.25rem] border border-white/10 px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="poster-sheen pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-center">
            <div className="mx-auto w-full max-w-sm">
              <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-black/25 shadow-[0_32px_90px_rgba(0,0,0,0.42)]">
                <div className="absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <BookCoverArtwork
                  title={moment.book.title}
                  slug={moment.book.slug}
                  coverUrl={moment.book.coverUrl}
                  className="aspect-[3/4] w-full"
                  titleClassName="px-8 text-3xl"
                />
              </div>
            </div>

            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-300">Публичная цитата</p>
              <h1 className="mt-3 text-4xl font-semibold leading-none tracking-tight text-white sm:text-5xl lg:text-6xl">
                {moment.book.title}
              </h1>
              <p className="mt-4 text-lg text-white/70">
                {moment.book.author.name}
              </p>

              <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-black/25 p-5 text-white/85 shadow-[0_18px_50px_rgba(0,0,0,0.26)]">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/50">
                  {moment.chapter.position > 0 ? `Глава ${moment.chapter.position}` : 'Глава'}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  {moment.chapter.title}
                </h2>
                <blockquote className="mt-5 text-xl leading-8 text-white/88 sm:text-2xl sm:leading-9">
                  {moment.quoteText}
                </blockquote>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={readerHref} className="inline-flex">
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-white text-slate-950 shadow-[0_18px_40px_rgba(255,255,255,0.18)] hover:bg-white/95"
                  >
                    <BookOpen className="mr-2" size={18} />
                    Читать в книге
                  </Button>
                </Link>
                <Link href={bookPath} className="inline-flex">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-full border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white"
                  >
                    О книге
                  </Button>
                </Link>
              </div>

              <p className="mt-4 text-sm text-white/55">
                Публичная страница цитаты. Техническая ссылка для чтения сохранена внутри кнопки «Читать в книге».
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
