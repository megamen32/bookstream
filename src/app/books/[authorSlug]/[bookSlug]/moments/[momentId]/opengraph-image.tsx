import { getPublicBookMomentById } from '@/lib/public-books'
import { renderMomentShareCardPng } from '@/lib/share-card'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface LegacyPublicMomentImageProps {
  params: Promise<{
    momentId: string
  }>
}

export default async function LegacyPublicMomentImage({ params }: LegacyPublicMomentImageProps) {
  const resolvedParams = await params
  const moment = await getPublicBookMomentById(resolvedParams.momentId)

  if (!moment) {
    return new Response('Not found', { status: 404 })
  }

  const image = await renderMomentShareCardPng({
    title: moment.book.title,
    coverUrl: moment.book.coverUrl,
    authorName: moment.book.author.name,
    chapterTitle: moment.chapter.title,
    quoteText: moment.quoteText,
    slug: moment.book.slug,
  })

  return new Response(image, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  })
}
