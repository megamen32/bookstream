'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useReaderStore } from '@/lib/store'
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

interface CommentComposerProps {
  onSend: (body: string) => void
}

export default function CommentComposer({ onSend }: CommentComposerProps) {
  const { replyingTo, setReplyingTo, username, setUsername, readerId } = useReaderStore()
  const [text, setText] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const handleSend = useCallback(() => {
    if (!text.trim() || cooldown > 0) return

    onSend(text.trim())
    setText('')
    setReplyingTo(null)
    setCooldown(15)
  }, [text, cooldown, onSend, setReplyingTo])

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
    <div className="comment-composer">
      {/* Username bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          marginBottom: replyingTo ? '0.375rem' : '0',
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

      {/* Quote bar */}
      {replyingTo && (
        <div className="quote-bar">
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

      {/* Input row */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
