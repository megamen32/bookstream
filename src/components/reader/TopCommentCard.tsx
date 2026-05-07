'use client'

import CommentCard from '@/components/comments/CommentCard'
import type { ReaderComment } from './comment-types'

interface TopCommentCardProps {
  comment: ReaderComment
  chapterHref: string
  quoteHref?: string
  onToggleVote?: (() => void) | null
  voteDisabled?: boolean
}

export default function TopCommentCard({
  comment,
  chapterHref,
  quoteHref,
  onToggleVote = null,
  voteDisabled = false,
}: TopCommentCardProps) {
  return (
    <CommentCard
      comment={comment}
      chapterHref={chapterHref}
      quoteHref={quoteHref || chapterHref}
      onToggleVote={onToggleVote}
      voteDisabled={voteDisabled}
      bodyLines={2}
      quoteLines={2}
    />
  )
}
