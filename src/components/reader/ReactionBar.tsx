'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useReaderStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const DEFAULT_EMOJIS = ['👍', '🔥', '💡', '😂', '⭐'] as const

interface ReactionBarProps {
  paragraphId: string
  variantId: string
  chapterId?: string
  variantType?: string
  showOnMobile?: boolean
  onUserReactionChange?: (paragraphId: string, hasReaction: boolean, emoji: string | null) => void
}

interface ReactionEntry {
  count: number
  reacted: boolean
}

type ReactionsMap = Record<string, ReactionEntry>

function createEmptyReactions(): ReactionsMap {
  return Object.fromEntries(
    DEFAULT_EMOJIS.map((emoji) => [emoji, { count: 0, reacted: false }])
  ) as ReactionsMap
}

export default function ReactionBar({
  paragraphId,
  variantId,
  chapterId: chapterIdProp,
  variantType: variantTypeProp,
  showOnMobile = false,
  onUserReactionChange,
}: ReactionBarProps) {
  const readerId = useReaderStore((s) => s.readerId)
  const username = useReaderStore((s) => s.username)
  const bookId = useReaderStore((s) => s.bookId)
  const chapterIdFromStore = useReaderStore((s) => s.chapterId)
  const variantTypeFromStore = useReaderStore((s) => s.variantType)
  const showCommunityAnnotations = useReaderStore((s) => s.showCommunityAnnotations)
  const chapterId = chapterIdProp ?? chapterIdFromStore
  const variantType = variantTypeProp ?? variantTypeFromStore
  const [reactions, setReactions] = useState<ReactionsMap>(createEmptyReactions())
  const [toggling, setToggling] = useState<string | null>(null)
  const [pulsingEmoji, setPulsingEmoji] = useState<string | null>(null)
  const pulsingTimeoutRef = useRef<number | null>(null)

  const refreshReactions = useCallback(
    async (signal?: AbortSignal) => {
      if (!paragraphId || !variantId) return

      try {
        const params = new URLSearchParams({
          paragraphId,
          chapterVariantId: variantId,
        })
        const res = await fetch(`/api/reactions?${params.toString()}`, {
          signal,
        })
        if (!res.ok) return

        const data = await res.json()
        const incoming = Array.isArray(data) ? data : []

        const merged: ReactionsMap = createEmptyReactions()
        for (const entry of incoming) {
          const readerIds = Array.isArray(entry.readerIds) ? entry.readerIds : []
          const reacted = readerIds.includes(readerId)
          merged[entry.emoji] = {
            count: showCommunityAnnotations
              ? entry.count ?? 0
              : reacted ? 1 : 0,
            reacted,
          }
        }

        for (const emoji of DEFAULT_EMOJIS) {
          if (!merged[emoji]) {
            merged[emoji] = { count: 0, reacted: false }
          }
        }
        setReactions(merged)
      } catch {
        // silently ignore — bar stays empty
      }
    },
    [paragraphId, variantId, readerId, showCommunityAnnotations],
  )

  // Fetch existing reactions on mount / when paragraph or variant changes
  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      void refreshReactions(controller.signal)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [refreshReactions])

  useEffect(() => {
    const handleReactionUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ paragraphId: string; chapterVariantId: string }>
      if (
        customEvent.detail?.paragraphId === paragraphId &&
        customEvent.detail?.chapterVariantId === variantId
      ) {
        void refreshReactions()
      }
    }

    window.addEventListener('bookstream:reaction-updated', handleReactionUpdate)
    return () => window.removeEventListener('bookstream:reaction-updated', handleReactionUpdate)
  }, [paragraphId, variantId, refreshReactions])

  // Toggle reaction
  const handleToggle = useCallback(
    async (emoji: string) => {
      if (!readerId || toggling) return

      const current = reactions[emoji] ?? { count: 0, reacted: false }
      const isAdding = !current.reacted

      // Optimistic update
      setReactions((prev) => ({
        ...prev,
        [emoji]: {
          count: isAdding
            ? (prev[emoji]?.count ?? 0) + 1
            : Math.max(0, (prev[emoji]?.count ?? 0) - 1),
          reacted: isAdding,
        },
      }))
      setToggling(emoji)

      try {
        const res = await fetch('/api/reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paragraphId,
            chapterVariantId: variantId,
            readerId,
            emoji,
            username,
            bookId,
            chapterId,
            variantType,
          }),
        })

        if (!res.ok) {
          // Revert optimistic update on failure
          setReactions((prev) => ({
            ...prev,
            [emoji]: current,
          }))
          return
        }

        if (isAdding) {
          setPulsingEmoji(emoji)
          if (pulsingTimeoutRef.current) {
            window.clearTimeout(pulsingTimeoutRef.current)
          }
          pulsingTimeoutRef.current = window.setTimeout(() => {
            setPulsingEmoji((currentEmoji) => (currentEmoji === emoji ? null : currentEmoji))
          }, 650)
        }
      } catch {
        // Revert on network error
        setReactions((prev) => ({
          ...prev,
          [emoji]: current,
        }))
      } finally {
        setToggling(null)
      }
    },
    [bookId, chapterId, paragraphId, readerId, reactions, toggling, username, variantId, variantType],
  )

  useEffect(() => {
    return () => {
      if (pulsingTimeoutRef.current) {
        window.clearTimeout(pulsingTimeoutRef.current)
      }
    }
  }, [])

  // Don't render if no reactions and still loading (avoid flash)
  const displayedEmojis = Array.from(new Set([...DEFAULT_EMOJIS, ...Object.keys(reactions)]))

  useEffect(() => {
    const activeEmoji = displayedEmojis.find((emoji) => reactions[emoji]?.reacted) || null
    onUserReactionChange?.(paragraphId, Boolean(activeEmoji), activeEmoji)
  }, [displayedEmojis, onUserReactionChange, paragraphId, reactions])

  return (
    <div
      role="group"
      aria-label="Реакции"
      className={cn(
        'reaction-bar items-center gap-1 pt-2 transition-opacity duration-200 ease-in-out md:flex md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
        showOnMobile ? 'flex opacity-100' : 'hidden md:flex',
      )}
      style={{ color: 'var(--r-text-secondary)' }}
    >
      {displayedEmojis.map((emoji) => {
        const entry = reactions[emoji] ?? { count: 0, reacted: false }
        const isActive = entry.reacted
        const showCount = entry.count > 0
        const isTogglingThis = toggling === emoji

        return (
          <button
            key={emoji}
            onClick={() => handleToggle(emoji)}
            disabled={isTogglingThis}
            aria-label={`${emoji} ${showCount ? entry.count : ''}`}
            aria-pressed={isActive}
            title={
              isActive
                ? `Убрать реакцию ${emoji}`
                : `Поставить реакцию ${emoji}`
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.125rem',
              minWidth: '1.75rem',
              height: '1.9rem',
              padding: '0 0.4rem',
              borderRadius: '9999px',
              border: isActive
                ? '1px solid color-mix(in srgb, var(--r-accent) 70%, white 30%)'
                : '1px solid color-mix(in srgb, var(--r-border) 55%, transparent)',
              background: isActive
                ? 'color-mix(in srgb, var(--r-accent) 14%, var(--r-bg) 86%)'
                : 'color-mix(in srgb, var(--r-bg-secondary) 62%, transparent)',
              cursor: isTogglingThis ? 'wait' : 'pointer',
              color: isActive ? 'var(--r-accent)' : 'var(--r-text-secondary)',
              fontSize: '0.8125rem',
              lineHeight: 1,
              transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease, opacity 150ms ease',
              outline: 'none',
              userSelect: 'none',
              opacity: isTogglingThis ? 0.6 : 1,
              animation: pulsingEmoji === emoji ? 'reactionShake 650ms ease-out' : undefined,
              boxShadow: isActive ? '0 12px 24px rgba(0, 0, 0, 0.12)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--r-bg-secondary) 82%, white 18%)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px var(--r-accent)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <span
              style={{
                fontSize: '0.875rem',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {emoji}
            </span>
            {showCount && (
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  lineHeight: 1,
                  color: 'var(--r-text-secondary)',
                  minWidth: '0.5rem',
                  textAlign: 'center',
                }}
              >
                {entry.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
