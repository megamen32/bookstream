import { permanentRedirect } from 'next/navigation'
import { buildPublicBookPath } from '@/lib/public-sharing'

interface LegacyPublicBookPageProps {
  params: Promise<{
    authorSlug: string
    bookSlug: string
  }>
}

export default async function LegacyPublicBookPage({ params }: LegacyPublicBookPageProps): Promise<never> {
  const resolvedParams = await params
  permanentRedirect(buildPublicBookPath(resolvedParams.authorSlug, resolvedParams.bookSlug))
}
