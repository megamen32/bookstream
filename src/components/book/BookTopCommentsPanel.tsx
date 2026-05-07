'use client'

import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useReaderStore } from '@/lib/store'
import { sortCommentsByTop } from '@/lib/annotations'
import TopCommentCard from '@/components/reader/TopCommentCard'
import type { ReaderComment } from '@/components/reader/comment-types'

interface BookTopCommentsPanelProps {
  authorSlug: string
  bookSlug: string
  bookId: string
}

export default function BookTopCommentsPanel({
  authorSlug,
  bookSlug,
  bookId,
}: BookTopCommentsPanelProps) {
  const { readerId, loadFromStorage } = useReaderStore()
  const [comments, setComments] = useState<ReaderComment[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingCommentId, setTogglingCommentId] = useState<string | null>(null)

  useEffect(() => {
    if (readerId) return
    const frameId = window.requestAnimationFrame(() => {
      loadFromStorage()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [readerId, loadFromStorage])

  useEffect(() => {
    if (!bookId) return

    const controller = new AbortController()

    const fetchComments = async (): Promise<void> => {
      setLoading(true)

      try {
        const params = new URLSearchParams({ bookId })
        if (readerId) {
          params.set('readerId', readerId)
        }

        const response = await fetch(`/api/comments/list?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          setComments([])
          return
        }

        const data = await response.json()
        setComments(sortCommentsByTop(Array.isArray(data) ? data : []).slice(0, 3))
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch top comments:', error)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void fetchComments()
    return () => controller.abort()
  }, [bookId, readerId])

  const handleToggleVote = async (commentId: string): Promise<void> => {
    if (!readerId || togglingCommentId) return

    const previousComments = comments
    const optimisticComments = sortCommentsByTop(
      comments.map((comment) => (
        comment.id === commentId
          ? {
              ...comment,
              reacted: !comment.reacted,
              upvoteCount: comment.reacted
                ? Math.max(0, comment.upvoteCount - 1)
                : comment.upvoteCount + 1,
            }
          : comment
      )),
    )
    setComments(optimisticComments)
    setTogglingCommentId(commentId)

    try {
      const response = await fetch(`/api/annotations/${commentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readerId }),
      })

      if (!response.ok) {
        setComments(previousComments)
        return
      }

      const data = await response.json()
      setComments((current) => sortCommentsByTop(
        current.map((comment) => (
          comment.id === commentId
            ? {
                ...comment,
                reacted: Boolean(data.reacted),
                upvoteCount: Number.isFinite(data.upvoteCount) ? data.upvoteCount : comment.upvoteCount,
              }
            : comment
        )),
      ))
    } catch (error) {
      console.error('Failed to toggle comment vote:', error)
      setComments(previousComments)
    } finally {
      setTogglingCommentId(null)
    }
  }

  if (loading || comments.length === 0) {
    return null
  }

  return (
    <section className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-white/80">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
        <MessageSquare size={14} />
        Топ комментариев
      </div>
      <div className="space-y-3">
        {comments.map((comment) => (
          <TopCommentCard
            key={comment.id}
            comment={comment}
            chapterHref={`/${authorSlug}/${bookSlug}/read?chapter=${comment.chapterId}`}
            onToggleVote={() => void handleToggleVote(comment.id)}
            voteDisabled={!readerId || togglingCommentId === comment.id}
          />
        ))}
      </div>
    </section>
  )
}
