'use client'

import { useState } from 'react'
import { List, X } from 'lucide-react'

interface Chapter {
  id: string
  title: string
  level?: number
  position: number
}

interface TableOfContentsProps {
  chapters: Chapter[]
  currentChapterId: string
  onChapterChange: (chapterId: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}

export default function TableOfContents({
  chapters,
  currentChapterId,
  onChapterChange,
  open,
  onOpenChange,
  showTrigger = true,
}: TableOfContentsProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = typeof open === 'boolean'
  const isOpen = isControlled ? open : internalOpen

  const setOpen = (nextOpen: boolean): void => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  return (
    <>
      {showTrigger ? (
        <button
          onClick={() => setOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            minWidth: '44px',
            minHeight: '44px',
            color: 'var(--r-text)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          title="Оглавление"
        >
          <List size={20} />
        </button>
      ) : null}

      {isOpen && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="reader-layer-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.46)',
              zIndex: 56,
            }}
          />

          <div
            className="reader-floating-sheet slide-up-enter"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 57,
              backgroundColor: 'color-mix(in srgb, var(--r-bg) 94%, transparent)',
              borderTop: '1px solid color-mix(in srgb, var(--r-border) 82%, transparent)',
              borderRadius: '1.5rem 1.5rem 0 0',
              maxHeight: '68vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -28px 72px rgba(0,0,0,0.28)',
              backdropFilter: 'blur(26px) saturate(1.12)',
              WebkitBackdropFilter: 'blur(26px) saturate(1.12)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1rem 0.6rem',
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 650, color: 'var(--r-text)' }}>
                Оглавление
              </h3>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  borderRadius: '999px',
                  background: 'color-mix(in srgb, var(--r-bg-secondary) 72%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--r-border) 72%, transparent)',
                  cursor: 'pointer',
                  color: 'var(--r-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                width: '2.5rem',
                height: '0.25rem',
                backgroundColor: 'color-mix(in srgb, var(--r-text-secondary) 26%, transparent)',
                borderRadius: '9999px',
                margin: '0.3rem auto 0',
              }}
            />

            <div style={{ overflowY: 'auto', padding: '0.75rem 0.5rem', flex: 1 }}>
              {chapters.map((chapter) => {
                const isCurrent = chapter.id === currentChapterId
                return (
                  <button
                    key={chapter.id}
                    onClick={() => {
                      onChapterChange(chapter.id)
                      setOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      width: '100%',
                      padding: '0.82rem 0.85rem',
                      borderRadius: '1rem',
                      border: `1px solid ${isCurrent ? 'color-mix(in srgb, var(--r-accent) 26%, transparent)' : 'transparent'}`,
                      background: isCurrent
                        ? 'color-mix(in srgb, var(--r-accent) 14%, var(--r-bg) 86%)'
                        : 'transparent',
                      color: isCurrent ? 'var(--r-text)' : 'var(--r-text)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      textAlign: 'left',
                      minHeight: '48px',
                      fontWeight: isCurrent ? 600 : 450,
                      paddingInlineStart: `${0.85 + Math.max(0, (chapter.level ?? 1) - 1) * 1.25}rem`,
                    }}
                  >
                    <span
                      style={{
                        color: isCurrent ? 'var(--r-accent)' : 'var(--r-text-secondary)',
                        fontSize: '0.75rem',
                        minWidth: '1.5rem',
                      }}
                    >
                      {chapter.position + 1}.
                    </span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {chapter.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
