'use client'

import { useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useReaderStore } from '@/lib/store'
import { sortCommentsByTop } from '@/lib/annotations'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import TopCommentCard from './TopCommentCard'
import type { ReaderComment } from './comment-types'

interface FeedCommentsPreviewProps {
  chapterId: string
  chapterTitle: string
  authorSlug: string
  bookSlug: string
  comments: ReaderComment[]
  totalCount: number
}

export default function FeedCommentsPreview({
  chapterId,
  chapterTitle,
  authorSlug,
  bookSlug,
  comments,
  totalCount,
}: FeedCommentsPreviewProps) {
  const { readerId, showCommunityAnnotations } = useReaderStore()
  const [voteOverrides, setVoteOverrides] = useState<Record<string, { reacted: boolean; upvoteCount: number }>>({})
  const [togglingCommentId, setTogglingCommentId] = useState<string | null>(null)
  const items = useMemo(
    () => comments.map((comment) => ({
      ...comment,
      ...(voteOverrides[comment.id] || {}),
    })),
    [comments, voteOverrides],
  )
  const visibleComments = sortCommentsByTop(
    showCommunityAnnotations
      ? items
      : items.filter((comment) => comment.readerId === readerId),
  )

  if (visibleComments.length === 0) {
    return null
  }

  const visibleCount = showCommunityAnnotations ? totalCount : visibleComments.length

  const handleToggleVote = async (commentId: string): Promise<void> => {
    if (!readerId || togglingCommentId) return

    const currentComment = items.find((comment) => comment.id === commentId)
    if (!currentComment) return

    const previousOverride = voteOverrides[commentId]
    setVoteOverrides((current) => ({
      ...current,
      [commentId]: {
        reacted: !currentComment.reacted,
        upvoteCount: currentComment.reacted
          ? Math.max(0, currentComment.upvoteCount - 1)
          : currentComment.upvoteCount + 1,
      },
    }))
    setTogglingCommentId(commentId)

    try {
      const response = await fetch(`/api/annotations/${commentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readerId }),
      })

      if (!response.ok) {
        setVoteOverrides((current) => {
          const next = { ...current }
          if (previousOverride) {
            next[commentId] = previousOverride
          } else {
            delete next[commentId]
          }
          return next
        })
        return
      }

      const data = await response.json()
      setVoteOverrides((current) => ({
        ...current,
        [commentId]: {
          reacted: Boolean(data.reacted),
          upvoteCount: Number.isFinite(data.upvoteCount) ? data.upvoteCount : currentComment.upvoteCount,
        },
      }))
    } catch (error) {
      console.error('Failed to toggle comment vote:', error)
      setVoteOverrides((current) => {
        const next = { ...current }
        if (previousOverride) {
          next[commentId] = previousOverride
        } else {
          delete next[commentId]
        }
        return next
      })
    } finally {
      setTogglingCommentId(null)
    }
  }

  return (
    <section
      style={{
        marginTop: '1.25rem',
        borderRadius: '1rem',
        border: '1px solid var(--r-border)',
        backgroundColor: 'color-mix(in srgb, var(--r-bg-secondary) 78%, white 22%)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.875rem',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--r-accent)',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            <MessageSquare size={14} />
            Топ комментариев
          </div>
          <div
            style={{
              marginTop: '0.25rem',
              color: 'var(--r-text-secondary)',
              fontSize: '0.75rem',
            }}
          >
            {chapterTitle} · {visibleCount} {visibleCount === 1 ? 'комментарий' : 'комментариев'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {visibleComments.slice(0, 3).map((comment) => (
          <TopCommentCard
            key={comment.id}
            comment={comment}
            chapterHref={`/${authorSlug}/${bookSlug}/read?chapter=${comment.chapterId || chapterId}`}
            quoteHref={buildQuoteReadHref(authorSlug, bookSlug, {
              chapterId: comment.chapterId || chapterId,
              variantType: comment.variantType || comment.quotes[0]?.variantType || 'original',
              paragraphId: comment.paragraphId,
              paragraphEndId: comment.endParagraphId,
              startOffset: comment.startOffset,
              endOffset: comment.endOffset,
            })}
            onToggleVote={() => void handleToggleVote(comment.id)}
            voteDisabled={!readerId || togglingCommentId === comment.id}
            bodyLines={3}
          />
        ))}
      </div>
    </section>
  )
}
