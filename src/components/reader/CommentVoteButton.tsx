'use client'

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
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3 font-medium transition-colors',
        compact ? 'h-8 text-[0.78rem]' : 'h-9 text-sm',
        reacted
          ? 'border-primary/30 bg-primary/15 text-foreground'
          : 'border-border/70 bg-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/60 hover:text-foreground',
        className,
      ].filter(Boolean).join(' ')}
      aria-label={reacted ? 'Убрать лайк' : 'Поставить лайк'}
    >
      <ThumbsUp size={14} className={reacted ? 'shrink-0 fill-current' : 'shrink-0'} />
      {upvoteCount}
    </button>
  )
}
