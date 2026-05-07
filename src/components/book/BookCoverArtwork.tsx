'use client'

import { cn } from '@/lib/utils'

interface BookCoverArtworkProps {
  title: string
  slug: string
  coverUrl?: string | null
  className?: string
  titleClassName?: string
}

const GRADIENT_COLORS = [
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-sky-500 to-cyan-600',
  'from-lime-500 to-green-600',
]

/**
 * Renders a real cover image when available and falls back to the existing
 * gradient artwork otherwise.
 *
 * @param props Component props.
 * @returns Cover artwork block.
 */
export default function BookCoverArtwork({
  title,
  slug,
  coverUrl,
  className,
  titleClassName,
}: BookCoverArtworkProps) {
  if (coverUrl) {
    return (
      <div className={cn('relative overflow-hidden bg-muted', className)}>
        <img
          src={coverUrl}
          alt={`Обложка книги «${title}»`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-gradient-to-br flex items-center justify-center',
        getGradient(slug),
        className
      )}
    >
      <h3 className={cn('text-white font-bold text-center leading-tight', titleClassName)}>
        {title}
      </h3>
    </div>
  )
}

function getGradient(slug: string): string {
  let hash = 0
  for (let index = 0; index < slug.length; index += 1) {
    hash = slug.charCodeAt(index) + ((hash << 5) - hash)
  }
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length]
}
