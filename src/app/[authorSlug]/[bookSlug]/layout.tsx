import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getPublicBookBySlugs } from '@/lib/public-books'
import { buildPublicBookMetadata } from '@/lib/public-metadata'

interface BookRouteLayoutProps {
  children: ReactNode
  params: Promise<{
    authorSlug: string
    bookSlug: string
  }>
}

async function loadBook(authorSlug: string, bookSlug: string) {
  return getPublicBookBySlugs(authorSlug, bookSlug)
}

export async function generateMetadata({ params }: BookRouteLayoutProps): Promise<Metadata> {
  const resolvedParams = await params
  const book = await loadBook(resolvedParams.authorSlug, resolvedParams.bookSlug)

  if (!book) {
    return {
      title: 'Книга не найдена',
    }
  }

  return buildPublicBookMetadata(book)
}

export default function BookRouteLayout({ children }: BookRouteLayoutProps): ReactNode {
  return children
}
