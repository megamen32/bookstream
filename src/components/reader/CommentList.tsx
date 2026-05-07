'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { sortCommentsByTop } from '@/lib/annotations'
import { useReaderStore } from '@/lib/store'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare } from 'lucide-react'
import { ArrowUpRight } from 'lucide-react'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import CommentVoteButton from './CommentVoteButton'
import type { ReaderComment } from './comment-types'

const VARIANT_LABELS: Record<string, string> = {
  original: 'Оригинал',
  clean: 'Без воды',
  essence: 'Суть',
}

const VARIANT_CLASSES: Record<string, string> = {
  original: 'variant-badge original',
  clean: 'variant-badge clean',
  essence: 'variant-badge essence',
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

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 60%, 45%)`
}

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
                  <div
                    key={comment.id}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--r-bg-secondary)',
                      borderRadius: '0.5rem',
                    }}
                  >
                    {/* Quote */}
                    {comment.quotes && comment.quotes.length > 0 && (
                      authorSlug && bookSlug ? (
                        <Link
                          href={buildQuoteReadHref(authorSlug, bookSlug, {
                            chapterId,
                            variantType: comment.quotes[0].variantType,
                            paragraphId: comment.quotes[0].paragraphId,
                            paragraphEndId: comment.quotes[0].endParagraphId,
                          })}
                        className="quote-bar group"
                        style={{
                          marginBottom: '0.5rem',
                          fontSize: '0.75rem',
                          textDecoration: 'none',
                          display: 'grid',
                          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                          alignItems: 'flex-start',
                        }}
                        title="Открыть цитату в книге"
                      >
                          <span
                            className={VARIANT_CLASSES[comment.quotes[0].variantType] || VARIANT_CLASSES.original}
                            style={{ flexShrink: 0 }}
                          >
                            {VARIANT_LABELS[comment.quotes[0].variantType] || 'Оригинал'}
                          </span>
                        <span
                          style={{
                              minWidth: 0,
                              whiteSpace: 'normal',
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-word',
                              lineHeight: 1.45,
                          }}
                        >
                          {comment.quotes[0].selectedText}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-[color:var(--r-accent)] transition-transform duration-200 group-hover:translate-x-0.5">
                            В книгу
                            <ArrowUpRight size={11} />
                          </span>
                        </Link>
                      ) : (
                        <div
                        className="quote-bar"
                        style={{
                          marginBottom: '0.5rem',
                          fontSize: '0.75rem',
                          display: 'grid',
                          gridTemplateColumns: 'auto minmax(0, 1fr)',
                          alignItems: 'flex-start',
                        }}
                      >
                          <span
                            className={VARIANT_CLASSES[comment.quotes[0].variantType] || VARIANT_CLASSES.original}
                            style={{ flexShrink: 0 }}
                          >
                            {VARIANT_LABELS[comment.quotes[0].variantType] || 'Оригинал'}
                          </span>
                        <span
                          style={{
                              minWidth: 0,
                              whiteSpace: 'normal',
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-word',
                              lineHeight: 1.45,
                          }}
                        >
                          {comment.quotes[0].selectedText}
                          </span>
                        </div>
                      )
                    )}

                    {/* Comment body */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div
                        style={{
                          width: '2rem',
                          height: '2rem',
                          borderRadius: '50%',
                          backgroundColor: stringToColor(comment.username),
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {comment.username.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: stringToColor(comment.username) }}>
                            {comment.username}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--r-text-secondary)' }}>
                            {timeAgo(comment.createdAt)}
                          </span>
                          <div style={{ marginLeft: 'auto' }}>
                            <CommentVoteButton
                              reacted={comment.reacted}
                              upvoteCount={comment.upvoteCount}
                              disabled={!readerId || togglingCommentId === comment.id}
                              onClick={() => void handleToggleVote(comment.id)}
                              compact
                            />
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {comment.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
