import { getPublicBookBySlugs } from '@/lib/public-books'
import { renderBookShareCardPng } from '@/lib/share-card'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface LegacyPublicBookImageProps {
  params: Promise<{
    authorSlug: string
    bookSlug: string
  }>
}

export default async function LegacyPublicBookImage({ params }: LegacyPublicBookImageProps) {
  const resolvedParams = await params
  const book = await getPublicBookBySlugs(resolvedParams.authorSlug, resolvedParams.bookSlug)

  if (!book) {
    return new Response('Not found', { status: 404 })
  }

  const image = await renderBookShareCardPng({
    title: book.title,
    description: book.description,
    coverUrl: book.coverUrl,
    authorName: book.author.name,
    slug: book.slug,
  })

  return new Response(image, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  })
}
