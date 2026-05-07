'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface CommentVoteButtonProps {
  reacted: boolean
  upvoteCount: number
  disabled?: boolean
  onClick: () => void
  compact?: boolean
}

export default function CommentVoteButton({
  reacted,
  upvoteCount,
  disabled = false,
  onClick,
  compact = false,
}: CommentVoteButtonProps) {
  return (
    <Button
      type="button"
      variant={reacted ? 'default' : 'outline'}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={compact ? 'h-8 rounded-full px-3' : 'rounded-full'}
    >
      <Plus size={14} className="mr-1" />
      {upvoteCount}
    </Button>
  )
}
