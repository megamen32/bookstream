'use client'

import { useState } from 'react'
import { List, X } from 'lucide-react'

interface Chapter {
  id: string
  title: string
  position: number
}

interface TableOfContentsProps {
  chapters: Chapter[]
  currentChapterId: string
  onChapterChange: (chapterId: string) => void
}

export default function TableOfContents({
  chapters,
  currentChapterId,
  onChapterChange,
}: TableOfContentsProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(prev => !prev)}
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

      {/* Overlay panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex: 40,
            }}
          />

          {/* Panel */}
          <div
            className="slide-up-enter"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              backgroundColor: 'var(--r-bg)',
              borderTop: '1px solid var(--r-border)',
              borderRadius: '1rem 1rem 0 0',
              maxHeight: '60vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1rem 0.5rem',
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--r-text)' }}>
                Оглавление
              </h3>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--r-text-secondary)',
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drag indicator */}
            <div
              style={{
                width: '2rem',
                height: '0.25rem',
                backgroundColor: 'var(--r-border)',
                borderRadius: '9999px',
                margin: '0.5rem auto 0',
              }}
            />

            {/* Chapter list */}
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
                      padding: '0.75rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: isCurrent ? 'var(--r-accent)' : 'transparent',
                      color: isCurrent ? 'var(--r-accent-foreground)' : 'var(--r-text)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      textAlign: 'left',
                      minHeight: '48px',
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    <span
                      style={{
                        color: isCurrent ? 'var(--r-accent-foreground)' : 'var(--r-text-secondary)',
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
