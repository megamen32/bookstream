'use client'

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import { ArrowRight, MessageSquare, Quote } from 'lucide-react'
import CommentVoteButton from '@/components/reader/CommentVoteButton'
import type { ReaderComment } from '@/components/reader/comment-types'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import { useReaderStore, type ReplyQuote } from '@/lib/store'
import type { FeedSectionPreview } from './feed-types'
import TopCommentCard from './TopCommentCard'

interface ChapterAfterwordProps {
  chapterId: string
  chapterTitle: string
  authorSlug: string
  bookSlug: string
  preview?: FeedSectionPreview | null
  showCommentsAfterChapter?: boolean
  onOpenComments?: (chapterId: string, replyTo?: ReplyQuote | null) => void
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
}

interface VoteState {
  reacted: boolean
  upvoteCount: number
}

function buildReplyQuote(comment: ReaderComment): ReplyQuote | null {
  const quote = comment.quotes[0]
  if (!quote || !comment.paragraphId) {
    return null
  }

  return {
    text: quote.selectedText,
    variantType: comment.variantType || quote.variantType,
    paragraphId: comment.paragraphId,
    endParagraphId: comment.endParagraphId,
    startOffset: comment.startOffset,
    endOffset: comment.endOffset,
    selectedText: quote.selectedText,
  }
}

export default function ChapterAfterword({
  chapterId,
  chapterTitle,
  authorSlug,
  bookSlug,
  preview = null,
  showCommentsAfterChapter = true,
  onOpenComments,
}: ChapterAfterwordProps) {
  const { readerId, showCommunityAnnotations, username } = useReaderStore()
  const [commentVoteOverrides, setCommentVoteOverrides] = useState<Record<string, VoteState>>({})
  const [quoteVoteOverrides, setQuoteVoteOverrides] = useState<Record<string, VoteState>>({})
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const stats = preview?.stats || null
  const comments = useMemo(() => {
    const visibleComments = [
      preview?.leadComment,
      ...(preview?.freshComments || []),
    ].filter((comment): comment is ReaderComment => Boolean(comment))

    const deduped = visibleComments.filter((comment, index, items) => (
      items.findIndex((entry) => entry.id === comment.id) === index
    ))

    const filtered = showCommunityAnnotations
      ? deduped
      : deduped.filter((comment) => comment.readerId === readerId)

    return filtered.map((comment) => ({
      ...comment,
      ...(commentVoteOverrides[comment.id] || {}),
    }))
  }, [commentVoteOverrides, preview?.freshComments, preview?.leadComment, readerId, showCommunityAnnotations])
  const quotes = useMemo(() => {
    const visibleQuotes = preview?.quotesPreview || []
    return visibleQuotes.map((quote) => ({
      ...quote,
      ...(quoteVoteOverrides[quote.id] || {}),
    }))
  }, [preview?.quotesPreview, quoteVoteOverrides])
  const hasRichContent = Boolean(
    stats && (
      stats.commentsCount > 0 ||
      stats.reactionsCount > 0 ||
      stats.quotesCount > 0 ||
      comments.length > 0 ||
      quotes.length > 0
    ),
  )

  const afterwordClassName = [
    'chapter-afterword',
    showCommentsAfterChapter
      ? hasRichContent
        ? 'chapter-afterword--rich'
        : 'chapter-afterword--quiet'
      : 'chapter-afterword--compact',
  ].join(' ')
  const likesLabel = formatCount(stats.reactionsCount, 'лайк', 'лайка')
  const composerAvatar = readerId
    ? (username.trim().charAt(0).toUpperCase() || '•')
    : '⋯'

  if (!showCommentsAfterChapter) {
    return (
      <section className={afterwordClassName}>
        <button
          type="button"
          className="chapter-afterword__compact-button"
          onClick={() => onOpenComments?.(chapterId)}
        >
          <div className="chapter-afterword__compact-icon">
            <MessageSquare size={18} />
          </div>
          <div className="chapter-afterword__compact-text">
            <div className="chapter-afterword__compact-title">{chapterTitle}</div>
            <div className="chapter-afterword__compact-subtitle">
              Открыть обсуждение главы
            </div>
          </div>
          <span className="chapter-afterword__arrow">
            <ArrowRight size={18} />
          </span>
        </button>
      </section>
    )
  }

  if (!stats) {
    return (
      <section className={`${afterwordClassName} chapter-afterword--loading`}>
        <div className="chapter-afterword__top">
          <div className="chapter-afterword__kicker">Обсуждение</div>
          <div className="chapter-afterword__quiet-title">{chapterTitle}</div>
          <div className="chapter-afterword__quiet-subtitle">
            Подтягиваем комментарии и социальный слой этой главы.
          </div>
        </div>
      </section>
    )
  }

  const handleToggleVote = async (
    annotationId: string,
    current: VoteState,
    overrides: Record<string, VoteState>,
    setOverrides: Dispatch<SetStateAction<Record<string, VoteState>>>,
  ): Promise<void> => {
    if (!readerId || togglingId) {
      return
    }

    const previousOverride = overrides[annotationId] || null
    setOverrides((prev) => ({
      ...prev,
      [annotationId]: {
        reacted: !current.reacted,
        upvoteCount: current.reacted ? Math.max(0, current.upvoteCount - 1) : current.upvoteCount + 1,
      },
    }))
    setTogglingId(annotationId)

    try {
      const response = await fetch(`/api/annotations/${annotationId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readerId }),
      })

      if (!response.ok) {
        setOverrides((prev) => {
          const next = { ...prev }
          if (previousOverride) {
            next[annotationId] = previousOverride
          } else {
            delete next[annotationId]
          }
          return next
        })
        return
      }

      const data = await response.json() as VoteState
      setOverrides((prev) => ({
        ...prev,
        [annotationId]: {
          reacted: Boolean(data.reacted),
          upvoteCount: Number.isFinite(data.upvoteCount) ? data.upvoteCount : current.upvoteCount,
        },
      }))
    } catch (error) {
      console.error('Failed to toggle afterword vote:', error)
      setOverrides((prev) => {
        const next = { ...prev }
        if (previousOverride) {
          next[annotationId] = previousOverride
        } else {
          delete next[annotationId]
        }
        return next
      })
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <section className={afterwordClassName}>
      <div className="chapter-afterword__quiet-orb" aria-hidden="true" />

      <div className="chapter-afterword__top">
        <div className="chapter-afterword__kicker">После главы</div>

        <div className="chapter-afterword__title-row">
          <div>
            <div className="chapter-afterword__title">Что думают другие</div>
            <div className="chapter-afterword__subtitle">
              {formatCount(stats.commentsCount, 'комментарий', 'комментария')}
              {stats.quotesCount > 0 ? ` · ${formatCount(stats.quotesCount, 'цитата', 'цитаты')}` : ''}
              {stats.reactionsCount > 0 ? ` · ${likesLabel}` : ''}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="chapter-afterword__composer"
          onClick={() => onOpenComments?.(chapterId, null)}
        >
          <span className="chapter-afterword__composer-avatar" aria-hidden="true">
            {composerAvatar}
          </span>
          <span className="chapter-afterword__composer-copy">
            <span className="chapter-afterword__composer-placeholder">
              Введите комментарий
            </span>
          </span>
        </button>

        {comments.length > 0 ? (
          <div className="chapter-afterword__comments">
            {comments.slice(0, 4).map((comment, index) => {
              const replyQuote = buildReplyQuote(comment)
              return (
                <TopCommentCard
                  key={comment.id}
                  comment={comment}
                  quoteHref={buildQuoteReadHref(authorSlug, bookSlug, {
                    chapterId: comment.chapterId || chapterId,
                    variantType: comment.variantType || comment.quotes[0]?.variantType || 'original',
                    paragraphId: comment.paragraphId,
                    paragraphEndId: comment.endParagraphId,
                    startOffset: comment.startOffset,
                    endOffset: comment.endOffset,
                  })}
                  onToggleVote={() => void handleToggleVote(comment.id, comment, commentVoteOverrides, setCommentVoteOverrides)}
                  voteDisabled={!readerId || togglingId === comment.id}
                  bodyLines={3}
                  compact
                  showChapterLink={false}
                  metaLabel={index === 0 ? 'Главный комментарий' : 'Свежий комментарий'}
                  secondaryActionLabel="Ответить"
                  onSecondaryAction={() => onOpenComments?.(chapterId, replyQuote)}
                  className={index === 0 ? 'chapter-afterword__comment-card chapter-afterword__comment-card--lead' : 'chapter-afterword__comment-card'}
                />
              )
            })}
          </div>
        ) : (
          <div className="chapter-afterword__empty">
            <div className="chapter-afterword__quiet-title">{chapterTitle}</div>
            <div className="chapter-afterword__quiet-subtitle">
              Вы только что дочитали главу. Начните обсуждение, пока мысль ещё живая.
            </div>
            <button
              type="button"
              className="chapter-afterword__footer-button"
              onClick={() => onOpenComments?.(chapterId, null)}
            >
              <MessageSquare size={16} />
              Войти в обсуждение
            </button>
          </div>
        )}

        {quotes.length > 0 ? (
          <div className="chapter-afterword__quotes">
            <div className="chapter-afterword__quotes-header">
              <span className="chapter-afterword__quotes-title">Цитаты из этой главы</span>
              <button
                type="button"
                className="chapter-afterword__quotes-open"
                onClick={() => onOpenComments?.(chapterId, null)}
              >
                Все комментарии
              </button>
            </div>

            <div className="chapter-afterword__quotes-list">
              {quotes.slice(0, 2).map((quote) => (
                <div key={quote.id} className="chapter-afterword__quote-row">
                  <Link
                    href={buildQuoteReadHref(authorSlug, bookSlug, {
                      chapterId: quote.chapterId || chapterId,
                      variantType: quote.variantType,
                      paragraphId: quote.paragraphId,
                      paragraphEndId: quote.paragraphEndId,
                      startOffset: quote.startOffset,
                      endOffset: quote.endOffset,
                    })}
                    className="chapter-afterword__quote-link"
                  >
                    <span className="chapter-afterword__quote-icon">
                      <Quote size={13} />
                    </span>
                    <span className="chapter-afterword__quote-text">{quote.text}</span>
                  </Link>
                  <div className="chapter-afterword__quote-actions">
                    <CommentVoteButton
                      reacted={quote.reacted}
                      upvoteCount={quote.upvoteCount}
                      compact
                      disabled={!readerId || togglingId === quote.id}
                      className="chapter-afterword__vote-button"
                      onClick={() => void handleToggleVote(quote.id, quote, quoteVoteOverrides, setQuoteVoteOverrides)}
                    />
                    <button
                      type="button"
                      className="chapter-afterword__reply-button"
                      onClick={() => onOpenComments?.(chapterId, {
                        text: quote.text,
                        variantType: quote.variantType,
                        paragraphId: quote.paragraphId || '',
                        endParagraphId: quote.paragraphEndId,
                        startOffset: quote.startOffset,
                        endOffset: quote.endOffset,
                        selectedText: quote.text,
                      })}
                    >
                      Ответить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {comments.length > 0 ? (
          <button
            type="button"
            className="chapter-afterword__footer-button chapter-afterword__footer-button--secondary"
            onClick={() => onOpenComments?.(chapterId, null)}
          >
            <MessageSquare size={16} />
            Все комментарии
          </button>
        ) : null}
      </div>
    </section>
  )
}
