import { permanentRedirect } from 'next/navigation'
import { buildPublicMomentPath } from '@/lib/public-sharing'

interface LegacyPublicMomentPageProps {
  params: Promise<{
    authorSlug: string
    bookSlug: string
    momentId: string
  }>
}

export default async function LegacyPublicMomentPage({ params }: LegacyPublicMomentPageProps): Promise<never> {
  const resolvedParams = await params
  permanentRedirect(buildPublicMomentPath(resolvedParams.authorSlug, resolvedParams.bookSlug, resolvedParams.momentId))
}
