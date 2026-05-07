'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { sortCommentsByTop, sortItemsByCreatedAt } from '@/lib/annotations'
import { useReaderStore } from '@/lib/store'
import { MessageSquare } from 'lucide-react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import TopCommentCard from './TopCommentCard'
import type { CommentSubmitHandler, ReaderComment } from './comment-types'

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

const COMMENT_CREATED_EVENT = 'bookstream:comment-created'

interface CommentCreatedDetail {
  chapterId: string
  comment: ReaderComment
}

interface CommentsSectionProps {
  chapterId?: string
  bookId?: string
  onSendComment?: CommentSubmitHandler
  /** Ref to the section so parent can scroll to it */
  sectionRef?: React.RefObject<HTMLDivElement | null>
  authorSlug?: string
  bookSlug?: string
  showComposer?: boolean
}

type CommentSortMode = 'top' | 'date'

function sortComments(comments: ReaderComment[], sortMode: CommentSortMode): ReaderComment[] {
  if (sortMode === 'date') {
    return sortItemsByCreatedAt(comments)
  }

  return sortCommentsByTop(comments)
}

function prependUniqueComment(
  comments: ReaderComment[],
  comment: ReaderComment,
  sortMode: CommentSortMode,
): ReaderComment[] {
  if (comments.some((item) => item.id === comment.id)) {
    return comments
  }

  return sortComments([comment, ...comments], sortMode)
}

export default function CommentsSection({
  chapterId,
  bookId,
  onSendComment,
  sectionRef,
  authorSlug,
  bookSlug,
  showComposer = true,
}: CommentsSectionProps) {
  const {
    replyingTo,
    setReplyingTo,
    username,
    setUsername,
    readerId,
    showCommunityAnnotations,
  } = useReaderStore()
  const [comments, setComments] = useState<ReaderComment[]>([])
  const [text, setText] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [togglingCommentId, setTogglingCommentId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<CommentSortMode>('top')
  const inputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!chapterId && !bookId) {
      return
    }

    let isCancelled = false

    const loadComments = async (): Promise<void> => {
      try {
        const params = new URLSearchParams()
        if (readerId) {
          params.set('readerId', readerId)
        }
        let url: string
        if (chapterId) {
          url = `/api/chapters/${chapterId}/comments?${params.toString()}`
        } else {
          if (!bookId) {
            return
          }
          url = `/api/comments/list?bookId=${bookId}${readerId ? `&readerId=${readerId}` : ''}`
        }
        const res = await fetch(url)
        if (!res.ok) {
          return
        }

        const data = await res.json() as { comments?: ReaderComment[] }
        if (!isCancelled) {
          setComments(Array.isArray(data.comments) ? data.comments : [])
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to fetch comments:', error)
        }
      }
    }

    void loadComments()

    return () => {
      isCancelled = true
    }
  }, [bookId, chapterId, readerId])

  useEffect(() => {
    const handleCommentCreated = (event: Event): void => {
      const customEvent = event as CustomEvent<CommentCreatedDetail>
      if (customEvent.detail.chapterId !== chapterId) {
        return
      }

      setComments((prev) => prependUniqueComment(prev, customEvent.detail.comment, sortMode))
    }

    window.addEventListener(COMMENT_CREATED_EVENT, handleCommentCreated)
    return () => {
      window.removeEventListener(COMMENT_CREATED_EVENT, handleCommentCreated)
    }
  }, [chapterId, sortMode])

  // Auto-focus when replying
  useEffect(() => {
    if (replyingTo && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [replyingTo])

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => {
        if (cooldownRef.current) clearInterval(cooldownRef.current)
      }
    }
  }, [cooldown])

  const handleSend = async (): Promise<void> => {
    if (!text.trim() || cooldown > 0 || isSending || !onSendComment) return

    setIsSending(true)
    try {
      const createdComment = await onSendComment(text.trim())
      if (!createdComment) {
        return
      }

      setComments((prev) => prependUniqueComment(prev, createdComment, sortMode))
      if (chapterId) {
        window.dispatchEvent(new CustomEvent<CommentCreatedDetail>(COMMENT_CREATED_EVENT, {
          detail: {
            chapterId,
            comment: createdComment,
          },
        }))
      }
      setText('')
      setReplyingTo(null)
      setCooldown(15)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleNameSubmit = () => {
    setIsEditingName(false)
  }

  const handleToggleVote = async (commentId: string): Promise<void> => {
    if (!readerId || togglingCommentId) return

    const previousComments = comments
    const optimisticComments = sortComments(
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
      sortMode,
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
      setComments((currentComments) => sortComments(
        currentComments.map((comment) => (
          comment.id === commentId
            ? {
                ...comment,
                reacted: Boolean(data.reacted),
                upvoteCount: Number.isFinite(data.upvoteCount) ? data.upvoteCount : comment.upvoteCount,
              }
            : comment
        )),
        sortMode,
      ))
    } catch (error) {
      console.error('Failed to toggle comment vote:', error)
      setComments(previousComments)
    } finally {
      setTogglingCommentId(null)
    }
  }

  const visibleComments = useMemo(() => {
    const filtered = chapterId && !showCommunityAnnotations
      ? comments.filter((comment) => comment.readerId === readerId)
      : comments

    return sortComments(filtered, sortMode)
  }, [chapterId, comments, readerId, showCommunityAnnotations, sortMode])

  const emptyStateText = chapterId
    ? (showCommunityAnnotations
        ? 'Пока нет комментариев. Будьте первым!'
        : 'Пока нет ваших комментариев в этой главе.')
    : 'Пока нет комментариев к этой книге.'

  return (
    <div
      ref={sectionRef}
      style={{
        borderTop: '1px solid color-mix(in srgb, var(--r-border) 72%, transparent)',
        paddingTop: '1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={16} style={{ color: 'var(--r-accent)' }} />
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--r-text)' }}>
            Комментарии
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--r-text-secondary)' }}>
            ({visibleComments.length})
          </span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            gap: '0.25rem',
            padding: '0.25rem',
            borderRadius: '9999px',
            backgroundColor: 'color-mix(in srgb, var(--r-bg-secondary) 74%, transparent)',
            border: '1px solid color-mix(in srgb, var(--r-border) 70%, transparent)',
            backdropFilter: 'blur(14px)',
          }}
          aria-label="Сортировка комментариев"
        >
          <button
            type="button"
            onClick={() => setSortMode('top')}
            style={{
              border: 'none',
              backgroundColor: sortMode === 'top' ? 'var(--r-accent)' : 'transparent',
              color: sortMode === 'top' ? 'var(--r-accent-foreground)' : 'var(--r-text-secondary)',
              borderRadius: '9999px',
              padding: '0.4rem 0.8rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Рейтинг
          </button>
          <button
            type="button"
            onClick={() => setSortMode('date')}
            style={{
              border: 'none',
              backgroundColor: sortMode === 'date' ? 'var(--r-accent)' : 'transparent',
              color: sortMode === 'date' ? 'var(--r-accent-foreground)' : 'var(--r-text-secondary)',
              borderRadius: '9999px',
              padding: '0.4rem 0.8rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Дата
          </button>
        </div>
      </div>

      {chapterId && !showCommunityAnnotations && (
        <div
          style={{
            marginBottom: '0.75rem',
            borderRadius: '1rem',
            backgroundColor: 'color-mix(in srgb, var(--r-bg-secondary) 70%, transparent)',
            border: '1px solid color-mix(in srgb, var(--r-border) 65%, transparent)',
            padding: '0.75rem 0.9rem',
            color: 'var(--r-text-secondary)',
            fontSize: '0.75rem',
          }}
        >
          Показаны только ваши комментарии.
        </div>
      )}

      {visibleComments.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '1.5rem 1rem',
            color: 'var(--r-text-secondary)',
            fontSize: '0.8125rem',
          }}
        >
          {emptyStateText}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: showComposer ? '1rem' : 0 }}>
          {visibleComments.map((comment) => (
            <TopCommentCard
              key={comment.id}
              comment={comment}
              chapterHref={authorSlug && bookSlug
                ? `/${authorSlug}/${bookSlug}/read?chapter=${comment.chapterId}`
                : '#'}
              quoteHref={authorSlug && bookSlug && comment.chapterId
                ? buildQuoteReadHref(authorSlug, bookSlug, {
                    chapterId: comment.chapterId,
                    variantType: comment.variantType || comment.quotes[0]?.variantType || 'original',
                    paragraphId: comment.paragraphId,
                    paragraphEndId: comment.endParagraphId,
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

      {showComposer && chapterId && onSendComment ? (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              marginBottom: replyingTo ? '0.375rem' : '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--r-text-secondary)',
            }}
          >
            <span>вы: </span>
            {isEditingName ? (
              <input
                ref={nameInputRef}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSubmit()
                }}
                autoFocus
                style={{
                  fontSize: '0.75rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--r-accent)',
                  color: 'var(--r-accent)',
                  outline: 'none',
                  width: '8rem',
                  padding: '0 0.125rem',
                }}
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--r-accent)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                {username}
              </button>
            )}
            {!isEditingName && (
              <button
                onClick={() => setIsEditingName(true)}
                style={{
                  fontSize: '0.625rem',
                  color: 'var(--r-text-secondary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  marginLeft: '0.25rem',
                  textDecoration: 'underline',
                }}
              >
                [изменить]
              </button>
            )}
          </div>

          {replyingTo && (
            <div className="quote-bar" style={{ marginBottom: '0.5rem' }}>
              <span
                className={VARIANT_CLASSES[replyingTo.variantType] || VARIANT_CLASSES.original}
                style={{ flexShrink: 0 }}
              >
                {VARIANT_LABELS[replyingTo.variantType] || 'Оригинал'}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {replyingTo.text}
              </span>
              <button
                onClick={() => setReplyingTo(null)}
                style={{
                  flexShrink: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--r-text-secondary)',
                  padding: '0.25rem',
                  minWidth: '32px',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            padding: '0.4rem',
            paddingBottom: '1rem',
            borderRadius: '1.25rem',
            background: 'color-mix(in srgb, var(--r-bg-secondary) 66%, transparent)',
            border: '1px solid color-mix(in srgb, var(--r-border) 68%, transparent)',
            boxShadow: '0 14px 36px rgba(0, 0, 0, 0.08)',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Написать комментарий..."
              disabled={cooldown > 0 || isSending}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                borderRadius: '1.25rem',
                padding: '0.7rem 1rem',
                fontSize: '0.875rem',
                color: 'var(--r-text)',
                outline: 'none',
                minHeight: '44px',
              }}
            />
            <Button
              onClick={() => void handleSend()}
              disabled={!text.trim() || cooldown > 0 || isSending}
              size="sm"
              style={{
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                minWidth: '44px',
                padding: 0,
                backgroundColor: 'var(--r-accent)',
                color: 'var(--r-accent-foreground)',
                boxShadow: '0 10px 24px color-mix(in srgb, var(--r-accent) 28%, transparent)',
              }}
            >
              {cooldown > 0 ? `${cooldown}` : isSending ? '…' : '→'}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
