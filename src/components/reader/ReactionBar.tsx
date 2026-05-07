'use client'

import { useEffect, useState, useCallback } from 'react'
import { useReaderStore } from '@/lib/store'

const DEFAULT_EMOJIS = ['👍', '🔥', '💡', '😂', '⭐'] as const

interface ReactionBarProps {
  paragraphId: string
  variantId: string
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

export default function ReactionBar({ paragraphId, variantId }: ReactionBarProps) {
  const readerId = useReaderStore((s) => s.readerId)
  const [reactions, setReactions] = useState<ReactionsMap>(createEmptyReactions())
  const [toggling, setToggling] = useState<string | null>(null)

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
          merged[entry.emoji] = {
            count: entry.count ?? 0,
            reacted: Array.isArray(entry.readerIds) ? entry.readerIds.includes(readerId) : false,
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
    [paragraphId, variantId, readerId],
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
          }),
        })

        if (!res.ok) {
          // Revert optimistic update on failure
          setReactions((prev) => ({
            ...prev,
            [emoji]: current,
          }))
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
    [readerId, toggling, reactions, paragraphId, variantId],
  )

  // Don't render if no reactions and still loading (avoid flash)
  const displayedEmojis = Array.from(new Set([...DEFAULT_EMOJIS, ...Object.keys(reactions)]))

  return (
    <div
      className="
        reaction-bar
        flex items-center gap-1 pt-1
        opacity-100
        md:opacity-0 md:group-hover:opacity-100
        transition-opacity duration-200 ease-in-out
      "
      role="group"
      aria-label="Реакции"
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
              height: '1.75rem',
              padding: '0 0.25rem',
              borderRadius: '9999px',
              border: isActive
                ? '1px solid var(--r-accent)'
                : '1px solid transparent',
              background: isActive
                ? 'color-mix(in srgb, var(--r-accent) 12%, transparent)'
                : 'transparent',
              cursor: isTogglingThis ? 'wait' : 'pointer',
              color: isActive ? 'var(--r-accent)' : 'var(--r-text-secondary)',
              fontSize: '0.8125rem',
              lineHeight: 1,
              transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
              outline: 'none',
              userSelect: 'none',
              opacity: isTogglingThis ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--r-bg-secondary)'
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
