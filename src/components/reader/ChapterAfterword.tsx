'use client'

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import { ArrowRight, MessageSquare, Quote } from 'lucide-react'
import CommentVoteButton from '@/components/reader/CommentVoteButton'
import type { ReaderComment } from '@/components/reader/comment-types'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import { sortCommentsByTop, sortQuotesByTop } from '@/lib/annotations'
import { useReaderStore, type ReplyQuote } from '@/lib/store'
import type { FeedSectionPreview } from './feed-types'
import TopCommentCard from './TopCommentCard'

interface ChapterAfterwordProps {
  chapterId: string
  chapterTitle: string
  bookId: string
  authorSlug: string
  bookSlug: string
  preview?: FeedSectionPreview | null
  showCommentsAfterChapter?: boolean
  composerOpenChapterId?: string | null
  composerOpenRequest?: number
  onSendComment?: (body: string) => Promise<ReaderComment | null>
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
}

interface VoteState {
  reacted: boolean
  upvoteCount: number
}

interface ChapterQuote {
  id: string
  text: string
  variantType: string
  paragraphId: string
  paragraphEndId: string | null
  startOffset: number
  endOffset: number
  upvoteCount: number
  reacted: boolean
  chapterId: string
  createdAt: string
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function dedupeComments(comments: ReaderComment[]): ReaderComment[] {
  return comments.filter((comment, index, items) => (
    items.findIndex((entry) => entry.id === comment.id) === index
  ))
}

function dedupeQuotes(quotes: ChapterQuote[]): ChapterQuote[] {
  const seen = new Set<string>()
  return quotes.filter((quote) => {
    const normalized = normalizeText(quote.text)
    if (!normalized || seen.has(normalized)) {
      return false
    }

    seen.add(normalized)
    return true
  })
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
  bookId,
  authorSlug,
  bookSlug,
  preview = null,
  showCommentsAfterChapter = true,
  composerOpenChapterId = null,
  composerOpenRequest = 0,
  onSendComment,
}: ChapterAfterwordProps) {
  const {
    readerId,
    replyingTo,
    setReplyingTo,
    showCommunityAnnotations,
    username,
  } = useReaderStore()
  const [commentVoteOverrides, setCommentVoteOverrides] = useState<Record<string, VoteState>>({})
  const [quoteVoteOverrides, setQuoteVoteOverrides] = useState<Record<string, VoteState>>({})
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [commentsExpanded, setCommentsExpanded] = useState(false)
  const [loadedComments, setLoadedComments] = useState<ReaderComment[] | null>(null)
  const [loadingComments, setLoadingComments] = useState(false)
  const [visibleCommentCount, setVisibleCommentCount] = useState(3)
  const [quotesExpanded, setQuotesExpanded] = useState(false)
  const [loadedQuotes, setLoadedQuotes] = useState<ChapterQuote[] | null>(null)
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [composerText, setComposerText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [composerError, setComposerError] = useState<string | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const stats = preview?.stats || null

  useEffect(() => {
    setCommentsExpanded(false)
    setLoadedComments(null)
    setLoadingComments(false)
    setVisibleCommentCount(3)
    setQuotesExpanded(false)
    setLoadedQuotes(null)
    setLoadingQuotes(false)
    setComposerText('')
    setComposerError(null)
  }, [chapterId])

  useEffect(() => {
    if (composerOpenChapterId === chapterId && composerOpenRequest > 0) {
      setComposerExpanded(true)
    }
  }, [chapterId, composerOpenChapterId, composerOpenRequest])

  useEffect(() => {
    if (composerExpanded) {
      window.requestAnimationFrame(() => {
        composerRef.current?.focus()
      })
    }
  }, [composerExpanded])

  const baseComments = useMemo(() => {
    const visibleComments = [
      preview?.leadComment,
      ...(preview?.freshComments || []),
    ].filter((comment): comment is ReaderComment => Boolean(comment))

    const deduped = dedupeComments(visibleComments)

    return showCommunityAnnotations
      ? deduped
      : deduped.filter((comment) => comment.readerId === readerId)
  }, [preview?.freshComments, preview?.leadComment, readerId, showCommunityAnnotations])

  const comments = useMemo(() => {
    const source = loadedComments || baseComments
    const filtered = showCommunityAnnotations
      ? source
      : source.filter((comment) => comment.readerId === readerId)

    return sortCommentsByTop(filtered).slice(0, visibleCommentCount)
  }, [baseComments, loadedComments, readerId, showCommunityAnnotations, visibleCommentCount])

  const commentSourceCount = (loadedComments || baseComments).length
  const hasMoreComments = showCommunityAnnotations
    ? (stats?.commentsCount || 0) > comments.length
    : commentSourceCount > comments.length

  const baseQuotes = useMemo(() => {
    const visibleQuotes = preview?.quotesPreview || []
    return visibleQuotes.map((quote) => ({
      id: quote.id,
      text: quote.text,
      variantType: quote.variantType,
      paragraphId: quote.paragraphId || '',
      paragraphEndId: quote.paragraphEndId || null,
      startOffset: quote.startOffset || 0,
      endOffset: quote.endOffset || 0,
      upvoteCount: quote.upvoteCount,
      reacted: quote.reacted,
      chapterId: quote.chapterId,
      createdAt: quote.createdAt,
    }))
  }, [preview?.quotesPreview])

  const quotes = useMemo(() => {
    const source = loadedQuotes || baseQuotes
    const chapterQuotes = source.filter((quote) => quote.chapterId === chapterId)
    const deduped = dedupeQuotes(chapterQuotes)
    const sorted = sortQuotesByTop(deduped)
    return quotesExpanded ? sorted : sorted.slice(0, 2)
  }, [baseQuotes, chapterId, loadedQuotes, quotesExpanded])

  const fullQuoteCount = useMemo(() => {
    const source = loadedQuotes || baseQuotes
    const chapterQuotes = source.filter((quote) => quote.chapterId === chapterId)
    return dedupeQuotes(chapterQuotes).length
  }, [baseQuotes, chapterId, loadedQuotes])

  const hasMoreQuotes = fullQuoteCount > quotes.length
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

  const likesLabel = formatCount(stats?.reactionsCount || 0, 'лайк', 'лайка')
  const composerAvatar = readerId
    ? (username.trim().charAt(0).toUpperCase() || '•')
    : '⋯'

  const openComposer = (): void => {
    setComposerExpanded(true)
  }

  const handleComposerSubmit = async (): Promise<void> => {
    if (!onSendComment || !composerText.trim() || sendingComment) {
      return
    }

    setSendingComment(true)
    setComposerError(null)
    try {
      const nextComment = await onSendComment(composerText.trim())
      if (nextComment) {
        setComposerText('')
      } else {
        setComposerError('Не удалось отправить комментарий')
      }
    } finally {
      setSendingComment(false)
    }
  }

  const handleLoadMoreComments = async (): Promise<void> => {
    if (loadingComments) {
      return
    }

    if (!loadedComments) {
      setLoadingComments(true)
      try {
        const params = new URLSearchParams()
        if (readerId) {
          params.set('readerId', readerId)
        }
        const response = await fetch(`/api/chapters/${chapterId}/comments?${params.toString()}`)
        if (!response.ok) {
          return
        }

        const data = await response.json() as { comments?: ReaderComment[] }
        const fetchedComments = Array.isArray(data.comments) ? data.comments : []
        setLoadedComments(sortCommentsByTop(dedupeComments(fetchedComments)))
      } catch (error) {
        console.error('Failed to load chapter comments:', error)
      } finally {
        setLoadingComments(false)
      }
    }

    setCommentsExpanded(true)
    setVisibleCommentCount((current) => current + 10)
  }

  const handleLoadMoreQuotes = async (): Promise<void> => {
    if (loadingQuotes) {
      return
    }

    if (!loadedQuotes && bookId) {
      setLoadingQuotes(true)
      try {
        const params = new URLSearchParams()
        if (readerId) {
          params.set('readerId', readerId)
        }
        const query = params.toString()
        const response = await fetch(`/api/books/${bookId}/quotes${query ? `?${query}` : ''}`)
        if (!response.ok) {
          return
        }

        const data = await response.json() as { quotes?: ChapterQuote[] }
        const fetchedQuotes = Array.isArray(data.quotes) ? data.quotes : []
        setLoadedQuotes(fetchedQuotes.map((quote) => ({
          id: quote.id,
          text: quote.text,
          variantType: quote.variantType,
          paragraphId: quote.paragraphId,
          paragraphEndId: quote.paragraphEndId ?? null,
          startOffset: quote.startOffset,
          endOffset: quote.endOffset,
          upvoteCount: quote.upvoteCount,
          reacted: quote.reacted,
          chapterId: quote.chapterId,
          createdAt: quote.createdAt,
        })))
      } catch (error) {
        console.error('Failed to load chapter quotes:', error)
      } finally {
        setLoadingQuotes(false)
      }
    }

    setQuotesExpanded(true)
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

  if (!showCommentsAfterChapter) {
    return (
      <section className={afterwordClassName}>
        <button
          type="button"
          className="chapter-afterword__compact-button"
          onClick={openComposer}
        >
          <div className="chapter-afterword__compact-icon">
            <MessageSquare size={18} />
          </div>
          <div className="chapter-afterword__compact-text">
            <div className="chapter-afterword__compact-title">{chapterTitle}</div>
            <div className="chapter-afterword__compact-subtitle">
              Написать комментарий
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

        {composerExpanded ? (
          <div className="chapter-afterword__composer-panel">
            {replyingTo ? (
              <div className="chapter-afterword__composer-reply">
                <span className="chapter-afterword__composer-reply-label">Ответ на цитату</span>
                <span className="chapter-afterword__composer-reply-text">{replyingTo.text}</span>
                <button
                  type="button"
                  className="chapter-afterword__composer-reply-clear"
                  onClick={() => setReplyingTo(null)}
                  aria-label="Убрать цитату для ответа"
                >
                  ×
                </button>
              </div>
            ) : null}

            <textarea
              ref={composerRef}
              value={composerText}
              onChange={(event) => setComposerText(event.target.value)}
              placeholder="Написать комментарий..."
              className="chapter-afterword__composer-input"
              rows={3}
            />

            {composerError ? (
              <div className="chapter-afterword__composer-error">{composerError}</div>
            ) : null}

            <div className="chapter-afterword__composer-actions">
              <button
                type="button"
                className="chapter-afterword__composer-secondary"
                onClick={() => {
                  setComposerExpanded(false)
                  setReplyingTo(null)
                  setComposerError(null)
                }}
              >
                Свернуть
              </button>

              <button
                type="button"
                className="chapter-afterword__composer-send"
                onClick={() => void handleComposerSubmit()}
                disabled={!composerText.trim() || sendingComment}
              >
                {sendingComment ? 'Отправка…' : 'Отправить'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="chapter-afterword__composer"
            onClick={openComposer}
          >
            <span className="chapter-afterword__composer-avatar" aria-hidden="true">
              {composerAvatar}
            </span>
            <span className="chapter-afterword__composer-copy">
              <span className="chapter-afterword__composer-placeholder">
                Написать комментарий
              </span>
            </span>
          </button>
        )}

        {comments.length > 0 ? (
          <div className="chapter-afterword__comments">
            {comments.map((comment, index) => {
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
                  onSecondaryAction={() => {
                    if (replyQuote) {
                      setReplyingTo(replyQuote)
                    }
                    setComposerExpanded(true)
                  }}
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
            {composerExpanded ? null : (
              <button
                type="button"
                className="chapter-afterword__footer-button"
                onClick={openComposer}
              >
                <MessageSquare size={16} />
                Написать комментарий
              </button>
            )}
          </div>
        )}

        {comments.length > 0 && hasMoreComments ? (
          <button
            type="button"
            className="chapter-afterword__footer-button chapter-afterword__footer-button--secondary"
            onClick={() => void handleLoadMoreComments()}
            disabled={loadingComments}
          >
            <MessageSquare size={16} />
            {loadingComments ? 'Загрузка…' : commentsExpanded ? 'Показать ещё 10 комментариев' : 'Все комментарии'}
          </button>
        ) : null}

        {quotes.length > 0 ? (
          <div className="chapter-afterword__quotes">
            <div className="chapter-afterword__quotes-header">
              <span className="chapter-afterword__quotes-title">Цитаты из этой главы</span>
              {hasMoreQuotes ? (
                <button
                  type="button"
                  className="chapter-afterword__quotes-open"
                  onClick={() => void handleLoadMoreQuotes()}
                  disabled={loadingQuotes}
                >
                  {loadingQuotes
                    ? 'Загрузка…'
                    : quotesExpanded
                      ? 'Свернуть цитаты'
                      : 'Все цитаты показать'}
                </button>
              ) : null}
            </div>

            <div className="chapter-afterword__quotes-list">
              {quotes.map((quote) => (
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
                      onClick={() => {
                        setReplyingTo({
                          text: quote.text,
                          variantType: quote.variantType,
                          paragraphId: quote.paragraphId,
                          endParagraphId: quote.paragraphEndId,
                          startOffset: quote.startOffset,
                          endOffset: quote.endOffset,
                          selectedText: quote.text,
                        })
                        setComposerExpanded(true)
                      }}
                    >
                      Ответить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
