'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { ReaderComment } from './comment-types'
import CommentVoteButton from './CommentVoteButton'

interface TopCommentCardProps {
  comment: ReaderComment
  chapterHref: string
  onToggleVote?: (() => void) | null
  voteDisabled?: boolean
}

const VARIANT_LABELS: Record<string, string> = {
  original: 'Оригинал',
  clean: 'Без воды',
  essence: 'Суть',
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин.`
  if (hours < 24) return `${hours} ч.`
  if (days < 7) return `${days} д.`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function stringToColor(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash)
  }

  return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`
}

function clampParagraphStyle(lines: number): CSSProperties {
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
  }
}

export default function TopCommentCard({
  comment,
  chapterHref,
  onToggleVote = null,
  voteDisabled = false,
}: TopCommentCardProps) {
  const quote = comment.quotes[0]
  const avatarColor = stringToColor(comment.username)
  const chapterLabel = comment.chapterTitle
    ? Number.isFinite(comment.chapterPosition)
      ? `Глава ${comment.chapterPosition}. ${comment.chapterTitle}`
      : comment.chapterTitle
    : 'В книгу'

  return (
    <article className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: avatarColor }}
            >
              {comment.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold" style={{ color: avatarColor }}>
                  {comment.username}
                </span>
                <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                <Link
                  href={chapterHref}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {chapterLabel}
                  <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          </div>

          {quote ? (
            <Link
              href={chapterHref}
              className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
              title={quote.selectedText}
              aria-label={quote.selectedText}
            >
              <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                {VARIANT_LABELS[quote.variantType] || quote.variantType}
              </span>
              <span className="min-w-0 flex-1" style={clampParagraphStyle(2)}>
                {quote.selectedText}
              </span>
            </Link>
          ) : null}

          <p className="mt-3 text-sm leading-6 text-foreground/90" style={clampParagraphStyle(2)}>
            {comment.body}
          </p>
        </div>

        {onToggleVote ? (
          <CommentVoteButton
            reacted={comment.reacted}
            upvoteCount={comment.upvoteCount}
            disabled={voteDisabled}
            onClick={onToggleVote}
            compact
          />
        ) : null}
      </div>
    </article>
  )
}
