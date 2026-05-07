'use client'

import { useEffect, useState, useRef } from 'react'
import { sortCommentsByTop } from '@/lib/annotations'
import { useReaderStore } from '@/lib/store'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare } from 'lucide-react'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import CommentCard from '@/components/comments/CommentCard'
import type { ReaderComment } from './comment-types'

interface CommentListProps {
  chapterId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  authorSlug?: string
  bookSlug?: string
}

export default function CommentList({
  chapterId,
  open,
  onOpenChange,
  authorSlug,
  bookSlug,
}: CommentListProps) {
  const readerId = useReaderStore((state) => state.readerId)
  const [comments, setComments] = useState<ReaderComment[]>([])
  const [togglingCommentId, setTogglingCommentId] = useState<string | null>(null)

  const prevOpenRef = useRef(false)

  useEffect(() => {
    if (open && !prevOpenRef.current && chapterId) {
      const controller = new AbortController()
      ;(async () => {
        try {
          const params = new URLSearchParams()
          if (readerId) {
            params.set('readerId', readerId)
          }
          const res = await fetch(`/api/chapters/${chapterId}/comments?${params.toString()}`, { signal: controller.signal })
          if (res.ok) {
            const data = await res.json()
            setComments(sortCommentsByTop(Array.isArray(data.comments) ? data.comments : []))
          }
        } catch (e) {
          if (!controller.signal.aborted) {
            console.error('Failed to fetch comments:', e)
          }
        }
      })()
    }
    prevOpenRef.current = open
    return () => {
      // no-op cleanup; abort not needed since fetch completes fast
    }
  }, [open, chapterId, readerId])

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
      setComments((currentComments) => sortCommentsByTop(
        currentComments.map((comment) => (
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

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => onOpenChange(true)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--r-text)',
          padding: '0.5rem',
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Комментарии"
      >
        <MessageSquare size={20} />
      </button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl"
          style={{
            maxHeight: '70vh',
            backgroundColor: 'var(--r-bg)',
            color: 'var(--r-text)',
            border: 'none',
          }}
        >
          <SheetHeader>
            <SheetTitle style={{ color: 'var(--r-text)' }}>
              Комментарии ({comments.length})
            </SheetTitle>
          </SheetHeader>
          <ScrollArea style={{ maxHeight: 'calc(70vh - 4rem)', padding: '0 1rem 1rem' }}>
            {comments.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem 1rem',
                  color: 'var(--r-text-secondary)',
                  fontSize: '0.875rem',
                }}
              >
                Пока нет комментариев. Будьте первым!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    chapterHref={authorSlug && bookSlug ? `/${authorSlug}/${bookSlug}/read?chapter=${chapterId}` : undefined}
                    quoteHref={authorSlug && bookSlug && comment.quotes[0]
                      ? buildQuoteReadHref(authorSlug, bookSlug, {
                          chapterId,
                          variantType: comment.quotes[0].variantType,
                          paragraphId: comment.quotes[0].paragraphId,
                          paragraphEndId: comment.quotes[0].endParagraphId,
                          startOffset: comment.startOffset,
                          endOffset: comment.endOffset,
                        })
                      : undefined}
                    onToggleVote={() => void handleToggleVote(comment.id)}
                    voteDisabled={!readerId || togglingCommentId === comment.id}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
