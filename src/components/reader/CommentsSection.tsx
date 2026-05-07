'use client'

import { useEffect, useState, useRef } from 'react'
import { useReaderStore } from '@/lib/store'
import { MessageSquare } from 'lucide-react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

interface CommentsSectionProps {
  chapterId: string
  onSendComment: (body: string) => void
  /** Ref to the section so parent can scroll to it */
  sectionRef?: React.RefObject<HTMLDivElement | null>
}

export default function CommentsSection({ chapterId, onSendComment, sectionRef }: CommentsSectionProps) {
  const { replyingTo, setReplyingTo, username, setUsername } = useReaderStore()
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastFetchedChapterRef = useRef('')

  // Fetch comments when chapterId changes
  useEffect(() => {
    if (!chapterId || chapterId === lastFetchedChapterRef.current) return
    lastFetchedChapterRef.current = chapterId

    ;(async () => {
      try {
        const res = await fetch(`/api/chapters/${chapterId}/comments`)
        if (res.ok) {
          const data = await res.json()
          setComments(data.comments || [])
        }
      } catch (e) {
        console.error('Failed to fetch comments:', e)
      }
    })()
  }, [chapterId])

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

  const handleSend = () => {
    if (!text.trim() || cooldown > 0) return
    onSendComment(text.trim())
    setText('')
    setReplyingTo(null)
    setCooldown(15)
    // Re-fetch comments after sending
    lastFetchedChapterRef.current = ''
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNameSubmit = () => {
    setIsEditingName(false)
  }

  return (
    <div
      ref={sectionRef}
      style={{
        borderTop: '1px solid var(--r-border)',
        paddingTop: '1rem',
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <MessageSquare size={16} style={{ color: 'var(--r-accent)' }} />
        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--r-text)' }}>
          Комментарии
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--r-text-secondary)' }}>
          ({comments.length})
        </span>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '1.5rem 1rem',
            color: 'var(--r-text-secondary)',
            fontSize: '0.8125rem',
          }}
        >
          Пока нет комментариев. Будьте первым!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem' }}>
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
                  style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}
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

      {/* Composer — username bar */}
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

      {/* Composer — quote bar */}
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

      {/* Composer — input row */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingBottom: '1rem' }}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Написать комментарий..."
          disabled={cooldown > 0}
          style={{
            flex: 1,
            background: 'var(--r-bg-secondary)',
            border: '1px solid var(--r-border)',
            borderRadius: '1.25rem',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            color: 'var(--r-text)',
            outline: 'none',
            minHeight: '44px',
          }}
        />
        <Button
          onClick={handleSend}
          disabled={!text.trim() || cooldown > 0}
          size="sm"
          style={{
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            minWidth: '44px',
            padding: 0,
            backgroundColor: 'var(--r-accent)',
            color: 'var(--r-accent-foreground)',
          }}
        >
          {cooldown > 0 ? `${cooldown}` : '→'}
        </Button>
      </div>
    </div>
  )
}
