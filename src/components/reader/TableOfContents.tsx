'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight, List, X } from 'lucide-react'
import { buildChapterTree, type ChapterTreeNode, type ChapterTreeSource } from './chapter-tree'

type Chapter = ChapterTreeSource

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
  const chapterTree = useMemo(() => buildChapterTree(chapters), [chapters])

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
              {chapterTree.length > 0 ? renderChapterTree(chapterTree, currentChapterId, onChapterChange, setOpen) : null}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function renderChapterTree(
  nodes: ChapterTreeNode[],
  currentChapterId: string,
  onChapterChange: (chapterId: string) => void,
  closeTOC: (nextOpen: boolean) => void,
  depth = 0,
): ReactNode[] {
  return nodes.flatMap((node) => {
    const isCurrent = node.id === currentChapterId
    const targetChapterId = node.isContainer && node.firstReadableDescendantId
      ? node.firstReadableDescendantId
      : node.id
    const isDisabled = !targetChapterId

    return [
      <div
        key={node.id}
        style={{
          marginLeft: depth > 0 ? `${depth * 0.85}rem` : 0,
        }}
      >
        <button
          onClick={() => {
            if (isDisabled) {
              return
            }
            onChapterChange(targetChapterId)
            closeTOC(false)
          }}
          disabled={isDisabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            width: '100%',
            padding: '0.82rem 0.85rem',
            borderRadius: '1rem',
            border: `1px solid ${isCurrent ? 'color-mix(in srgb, var(--r-accent) 26%, transparent)' : 'transparent'}`,
            background: isCurrent
              ? 'color-mix(in srgb, var(--r-accent) 14%, var(--r-bg) 86%)'
              : node.isContainer
                ? 'color-mix(in srgb, var(--r-bg-secondary) 38%, transparent)'
                : 'transparent',
            color: isCurrent ? 'var(--r-text)' : 'var(--r-text)',
            cursor: isDisabled ? 'default' : 'pointer',
            fontSize: '0.875rem',
            textAlign: 'left',
            minHeight: '48px',
            fontWeight: node.isContainer ? 600 : isCurrent ? 600 : 450,
            opacity: node.isContainer && !node.firstReadableDescendantId ? 0.58 : 1,
          }}
        >
          <span
            style={{
              color: isCurrent ? 'var(--r-accent)' : 'var(--r-text-secondary)',
              fontSize: '0.75rem',
              minWidth: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {node.isContainer ? <ChevronRight size={14} /> : `${node.position + 1}.`}
          </span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {node.title}
          </span>
          {node.isContainer ? (
            <span
              style={{
                fontSize: '0.66rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--r-text-secondary)',
              }}
            >
              Раздел
            </span>
          ) : null}
        </button>
      </div>,
      ...(node.children.length > 0
        ? renderChapterTree(node.children, currentChapterId, onChapterChange, closeTOC, depth + 1)
        : []),
    ]
  })
}
