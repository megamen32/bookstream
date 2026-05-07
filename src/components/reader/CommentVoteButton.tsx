'use client'

import { Button } from '@/components/ui/button'
import { ThumbsUp } from 'lucide-react'

interface CommentVoteButtonProps {
  reacted: boolean
  upvoteCount: number
  disabled?: boolean
  onClick: () => void
  compact?: boolean
  className?: string
}

export default function CommentVoteButton({
  reacted,
  upvoteCount,
  disabled = false,
  onClick,
  compact = false,
  className,
}: CommentVoteButtonProps) {
  return (
    <Button
      type="button"
      variant={reacted ? 'default' : 'outline'}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={[
        compact
          ? 'h-8 rounded-full px-3 text-[0.78rem] font-semibold shadow-sm'
          : 'rounded-full text-sm font-semibold shadow-sm',
        className,
      ].filter(Boolean).join(' ')}
      aria-label={reacted ? 'Убрать лайк' : 'Поставить лайк'}
    >
      <ThumbsUp size={14} className="mr-1 shrink-0" />
      {upvoteCount}
    </Button>
  )
}
