'use client'

interface ChapterSkeletonProps {
  title: string
  height: number
  contentMaxWidth: string
}

/**
 * Reserves chapter space before text is available.
 */
export default function ChapterSkeleton({
  title,
  height,
  contentMaxWidth,
}: ChapterSkeletonProps) {
  return (
    <section
      className="feed-section feed-section--skeleton"
      style={{
        minHeight: height,
        maxWidth: contentMaxWidth,
        margin: '0 auto',
      }}
    >
      <div className="feed-chapter-header">
        <div className="feed-chapter-header__eyebrow">Глава</div>
        <h1 className="feed-chapter-header__title">{title}</h1>
      </div>

      <div className="feed-skeleton-lines" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </section>
  )
}
