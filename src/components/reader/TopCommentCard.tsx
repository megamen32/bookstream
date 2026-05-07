'use client'

import CommentCard from '@/components/comments/CommentCard'
import type { ReaderComment } from './comment-types'

interface TopCommentCardProps {
  comment: ReaderComment
  chapterHref?: string
  quoteHref?: string
  onToggleVote?: (() => void) | null
  voteDisabled?: boolean
  compact?: boolean
  showChapterLink?: boolean
  metaLabel?: string | null
  secondaryActionLabel?: string | null
  onSecondaryAction?: (() => void) | null
  className?: string
}

export default function TopCommentCard({
  comment,
  chapterHref,
  quoteHref,
  onToggleVote = null,
  voteDisabled = false,
  compact = false,
  showChapterLink = true,
  metaLabel = null,
  secondaryActionLabel = null,
  onSecondaryAction = null,
  className,
}: TopCommentCardProps) {
  return (
    <CommentCard
      comment={comment}
      chapterHref={chapterHref}
      quoteHref={quoteHref || chapterHref}
      onToggleVote={onToggleVote}
      voteDisabled={voteDisabled}
      bodyLines={compact ? 3 : 2}
      quoteLines={2}
      compact={compact}
      showChapterLink={showChapterLink}
      metaLabel={metaLabel}
      secondaryActionLabel={secondaryActionLabel}
      onSecondaryAction={onSecondaryAction}
      className={className}
    />
  )
}
