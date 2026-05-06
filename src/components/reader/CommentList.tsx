'use client'

import { useEffect, useState, useRef } from 'react'
import { useReaderStore } from '@/lib/store'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare } from 'lucide-react'

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

interface Comment {
  id: string
  readerId: string
  username: string
  body: string
  createdAt: string
  quotes: Array<{
    id: string
    variantType: string
    selectedText: string
  }>
}

interface CommentListProps {
  chapterId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  commentCount?: number
}

export default function CommentList({ chapterId, open, onOpenChange, commentCount }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([])

  const prevOpenRef = useRef(false)

  useEffect(() => {
    if (open && !prevOpenRef.current && chapterId) {
      const controller = new AbortController()
      ;(async () => {
        try {
          const res = await fetch(`/api/chapters/${chapterId}/comments`, { signal: controller.signal })
          if (res.ok) {
            const data = await res.json()
            setComments(data.comments || [])
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
  }, [open, chapterId])

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
        {commentCount !== undefined && commentCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '0.125rem',
              right: '0.125rem',
              backgroundColor: 'var(--r-accent)',
              color: 'var(--r-accent-foreground)',
              fontSize: '0.625rem',
              fontWeight: 700,
              width: '1.125rem',
              height: '1.125rem',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {commentCount > 99 ? '99+' : commentCount}
          </span>
        )}
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
                      <div
                        className="quote-bar"
                        style={{
                          marginBottom: '0.5rem',
                          fontSize: '0.75rem',
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
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {comment.quotes[0].selectedText}
                        </span>
                      </div>
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
