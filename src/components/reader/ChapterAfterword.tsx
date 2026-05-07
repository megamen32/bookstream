'use client'

import Link from 'next/link'
import { ArrowRight, MessageSquare, Quote, Sparkles } from 'lucide-react'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import type { FeedSectionPreview } from './feed-types'

interface ChapterAfterwordProps {
  chapterId: string
  chapterTitle: string
  authorSlug: string
  bookSlug: string
  preview?: FeedSectionPreview | null
  showCommentsAfterChapter?: boolean
  onOpenComments?: (chapterId: string) => void
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
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
  const stats = preview?.stats || null
  const comments = preview?.comments || []
  const topQuote = stats?.topQuote || null
  const hasRichContent = Boolean(
    stats && (
      stats.commentsCount > 0 ||
      stats.reactionsCount > 0 ||
      stats.quotesCount > 0 ||
      comments.length > 0 ||
      topQuote
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

  return (
    <section className={afterwordClassName}>
      <div className="chapter-afterword__quiet-orb" aria-hidden="true" />

      <div className="chapter-afterword__top">
        <div className="chapter-afterword__kicker">После главы</div>

        <div className="chapter-afterword__title-row">
          <div>
            <div className="chapter-afterword__title">{chapterTitle}</div>
            <div className="chapter-afterword__subtitle">
              {formatCount(stats.commentsCount, 'комментарий', 'комментария')}
              {' · '}
              {formatCount(stats.quotesCount, 'цитата', 'цитаты')}
              {' · '}
              {formatCount(stats.reactionsCount, 'реакция', 'реакции')}
            </div>
          </div>

          <button
            type="button"
            className="chapter-afterword__open-button"
            onClick={() => onOpenComments?.(chapterId)}
          >
            <MessageSquare size={14} />
            Обсудить
          </button>
        </div>

        <div className="chapter-afterword__stats chapter-afterword__stats--large">
          <div className="chapter-afterword__stat">
            <MessageSquare size={14} />
            <span>{stats.commentsCount}</span>
            <small>comments</small>
          </div>
          <div className="chapter-afterword__stat">
            <Sparkles size={14} />
            <span>{stats.reactionsCount}</span>
            <small>reactions</small>
          </div>
          <div className="chapter-afterword__stat">
            <Quote size={14} />
            <span>{stats.quotesCount}</span>
            <small>quotes</small>
          </div>
        </div>

        {topQuote ? (
          <Link
            href={buildQuoteReadHref(authorSlug, bookSlug, {
              chapterId,
              variantType: topQuote.variantType,
              paragraphId: topQuote.paragraphId,
              paragraphEndId: topQuote.paragraphEndId,
            })}
            className="chapter-afterword__top-quote"
          >
            <div className="chapter-afterword__top-quote-label">Топ-цитата</div>
            <div className="chapter-afterword__top-quote-text">{topQuote.text}</div>
            <div className="chapter-afterword__subtitle">
              {formatCount(topQuote.reactionsCount, 'реакция', 'реакции')}
              {' · '}
              {formatCount(topQuote.commentsCount, 'комментарий', 'комментария')}
            </div>
          </Link>
        ) : null}

        {comments.length > 0 ? (
          <div className="chapter-afterword__comments">
            {comments.slice(0, 3).map((comment) => (
              <button
                key={comment.id}
                type="button"
                className="chapter-afterword__comment"
                onClick={() => onOpenComments?.(chapterId)}
              >
                <div className="chapter-afterword__comment-author">{comment.authorName}</div>
                <div className="chapter-afterword__comment-body">{comment.body}</div>
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="chapter-afterword__footer-button"
            onClick={() => onOpenComments?.(chapterId)}
          >
            <MessageSquare size={16} />
            Открыть обсуждение главы
          </button>
        )}
      </div>
    </section>
  )
}
