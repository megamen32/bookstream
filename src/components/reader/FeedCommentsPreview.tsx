'use client'

import Link from 'next/link'
import { ArrowUpRight, MessageSquare } from 'lucide-react'
import { useReaderStore } from '@/lib/store'
import { buildQuoteReadHref } from '@/lib/quote-navigation'
import type { ReaderComment } from './comment-types'

interface FeedCommentsPreviewProps {
  chapterId: string
  chapterTitle: string
  authorSlug: string
  bookSlug: string
  comments: ReaderComment[]
  totalCount: number
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

export default function FeedCommentsPreview({
  chapterId,
  chapterTitle,
  authorSlug,
  bookSlug,
  comments,
  totalCount,
}: FeedCommentsPreviewProps) {
  const { readerId, showCommunityAnnotations } = useReaderStore()
  const visibleComments = showCommunityAnnotations
    ? comments
    : comments.filter((comment) => comment.readerId === readerId)

  if (visibleComments.length === 0) {
    return null
  }

  const visibleCount = showCommunityAnnotations ? totalCount : visibleComments.length

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
        {visibleComments.map((comment) => {
          const quote = comment.quotes[0]
          const avatarColor = stringToColor(comment.username)

          return (
            <article
              key={comment.id}
              style={{
                borderRadius: '0.875rem',
                backgroundColor: 'var(--r-bg)',
                padding: '0.875rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  marginBottom: '0.5rem',
                }}
              >
                <div
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '9999px',
                    backgroundColor: avatarColor,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {comment.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--r-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {comment.username}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--r-text-secondary)' }}>
                    {timeAgo(comment.createdAt)}
                  </div>
                </div>
              </div>

              {quote && (
                <Link
                  href={buildQuoteReadHref(authorSlug, bookSlug, {
                    chapterId,
                    variantType: quote.variantType,
                    paragraphId: quote.paragraphId,
                    paragraphEndId: quote.endParagraphId,
                  })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--r-bg-secondary)',
                    padding: '0.625rem 0.75rem',
                    color: 'inherit',
                    fontSize: '0.75rem',
                    textDecoration: 'none',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      borderRadius: '9999px',
                      backgroundColor: 'var(--r-accent)',
                      color: 'var(--r-accent-foreground)',
                      padding: '0.125rem 0.45rem',
                      fontWeight: 700,
                    }}
                  >
                    {VARIANT_LABELS[quote.variantType] || quote.variantType}
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--r-text-secondary)',
                    }}
                  >
                    {quote.selectedText}
                  </span>
                  <ArrowUpRight size={13} style={{ color: 'var(--r-accent)', flexShrink: 0 }} />
                </Link>
              )}

              <p
                style={{
                  margin: 0,
                  color: 'var(--r-text)',
                  fontSize: '0.875rem',
                  lineHeight: 1.55,
                }}
              >
                {comment.body}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
