'use client'

import Link from 'next/link'
import { ArrowUpRight, Ban, Reply } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import CommentVoteButton from '@/components/reader/CommentVoteButton'
import type { ReaderComment } from '@/components/reader/comment-types'
import { cn } from '@/lib/utils'

const VARIANT_LABELS: Record<string, string> = {
  original: 'Оригинал',
  clean: 'Без воды',
  essence: 'Суть',
}

export interface CommentCardComment extends ReaderComment {
  status?: string
}

interface CommentCardProps {
  comment: CommentCardComment
  chapterHref?: string
  chapterLabel?: string
  quoteHref?: string
  action?: ReactNode
  onToggleVote?: (() => void) | null
  voteDisabled?: boolean
  bodyLines?: number
  quoteLines?: number
  className?: string
  compact?: boolean
  showChapterLink?: boolean
  metaLabel?: string | null
  secondaryActionLabel?: string | null
  onSecondaryAction?: (() => void) | null
}

function formatRelativeDate(dateStr: string): string {
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

function clampParagraphStyle(lines?: number): CSSProperties | undefined {
  if (!lines || lines < 1) {
    return undefined
  }

  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
  }
}

export default function CommentCard({
  comment,
  chapterHref,
  chapterLabel,
  quoteHref,
  action,
  onToggleVote = null,
  voteDisabled = false,
  bodyLines,
  quoteLines,
  className,
  compact = false,
  showChapterLink = true,
  metaLabel = null,
  secondaryActionLabel = null,
  onSecondaryAction = null,
}: CommentCardProps) {
  const quote = comment.quotes[0]
  const avatarColor = stringToColor(comment.username)
  const resolvedChapterLabel = chapterLabel || (
    comment.chapterTitle
      ? Number.isFinite(comment.chapterPosition)
        ? `Глава ${comment.chapterPosition}. ${comment.chapterTitle}`
        : comment.chapterTitle
      : 'В книгу'
  )
  const bodyStyle = clampParagraphStyle(bodyLines)
  const quoteStyle = clampParagraphStyle(quoteLines)

  return (
    <article
      className={cn(
        'rounded-2xl border border-border/70 bg-card/90 shadow-sm',
        compact ? 'p-3.5' : 'p-4',
        comment.status === 'shadowbanned' && 'opacity-60',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                compact ? 'h-8 w-8' : 'h-9 w-9',
              )}
              style={{ backgroundColor: avatarColor }}
            >
              {comment.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cn(compact ? 'text-[0.82rem]' : 'text-sm', 'font-semibold')} style={{ color: avatarColor }}>
                  {comment.username}
                </span>
                {comment.status === 'shadowbanned' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    <Ban size={11} />
                    Скрыт
                  </span>
                ) : null}
                {metaLabel ? (
                  <span className="text-[0.72rem] font-medium text-muted-foreground">{metaLabel}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">{formatRelativeDate(comment.createdAt)}</span>
                {showChapterLink && chapterHref ? (
                  <Link
                    href={chapterHref}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {resolvedChapterLabel}
                    <ArrowUpRight size={12} />
                  </Link>
                ) : showChapterLink ? (
                  <span className="ml-auto text-xs font-medium text-muted-foreground">
                    {resolvedChapterLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {quote ? (
            quoteHref ? (
              <Link
                href={quoteHref}
                className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
                title={quote.selectedText}
                aria-label={quote.selectedText}
              >
                <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                  {VARIANT_LABELS[quote.variantType] || quote.variantType}
                </span>
                <span className="min-w-0 flex-1" style={quoteStyle}>
                  {quote.selectedText}
                </span>
              </Link>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                  {VARIANT_LABELS[quote.variantType] || quote.variantType}
                </span>
                <span className="min-w-0 flex-1" style={quoteStyle}>
                  {quote.selectedText}
                </span>
              </div>
            )
          ) : null}

          <p className={cn('mt-3 text-foreground/90', compact ? 'text-[0.92rem] leading-6' : 'text-sm leading-6')} style={bodyStyle}>
            {comment.body}
          </p>

          {action || onToggleVote || (secondaryActionLabel && onSecondaryAction) ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
              <div className="flex items-center gap-2">
                {action ? action : null}
                {!action && onToggleVote ? (
                  <CommentVoteButton
                    reacted={comment.reacted}
                    upvoteCount={comment.upvoteCount}
                    disabled={voteDisabled}
                    onClick={onToggleVote}
                    compact
                  />
                ) : null}
              </div>

              {secondaryActionLabel && onSecondaryAction ? (
                <button
                  type="button"
                  onClick={onSecondaryAction}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-transparent px-3 text-[0.76rem] font-semibold text-foreground/70 transition-colors hover:border-border/70 hover:bg-muted/60 hover:text-foreground"
                >
                  <Reply size={13} className="shrink-0" />
                  {secondaryActionLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
