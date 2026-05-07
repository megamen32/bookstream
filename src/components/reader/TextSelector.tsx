'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { Copy, Flame, Quote, Reply, SmilePlus } from 'lucide-react'
import { useReaderStore } from '@/lib/store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { collectParagraphRangeElements } from '@/lib/paragraph-selection'
import type { AnnotationKind } from '@/lib/annotations'

export interface SelectionAnnotationRange {
  id?: string
  kind: AnnotationKind
  paragraphId: string
  endParagraphId: string
  startOffset: number
  endOffset: number
  selectedText: string
  emoji?: string | null
  body?: string | null
}

interface TextSelectorProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  variantId: string
  onSelectionAnnotation?: (range: SelectionAnnotationRange, active: boolean) => void
}

interface ToolbarPosition {
  top: number
  left: number
  selectedText: string
  paragraphId: string
  endParagraphId: string
  startOffset: number
  endOffset: number
}

interface ReactionBurst {
  emoji: string
  top: number
  left: number
}

const TOOLBAR_HEIGHT = 56
const TOOLBAR_WIDTH = 248
const TOOLBAR_MARGIN = 8
const TOOLBAR_OFFSET = 12
const EMOJI_PICKER_GROUPS: Array<{ title: string; emojis: string[] }> = [
  {
    title: 'Частые',
    emojis: ['❤️', '🔥', '😂', '👏', '👍', '⭐', '💡', '🎉', '🙏', '🫶', '✨', '💯'],
  },
  {
    title: 'Люди',
    emojis: ['😀', '😁', '😊', '😍', '🥰', '😉', '🤔', '😎', '🥲', '😭', '🤯', '😴'],
  },
  {
    title: 'Жесты',
    emojis: ['👋', '👌', '✌️', '🤞', '🤟', '🤙', '🤝', '🙌', '💪', '🫰', '✋', '🫶'],
  },
  {
    title: 'Символы',
    emojis: ['💥', '⚡', '🌟', '🌈', '💖', '💜', '💚', '💙', '🧡', '💛', '❗', '❓'],
  },
  {
    title: 'Небольшой набор',
    emojis: ['🐶', '🐱', '🐼', '🦊', '🦄', '🐸', '🍀', '☕', '🍕', '🚀', '🎯', '📚'],
  },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

interface ToolbarButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
}

function ToolbarButton({ label, onClick, children }: ToolbarButtonProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          onMouseDown={(e) => e.preventDefault()}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export default function TextSelector({ containerRef, variantId, onSelectionAnnotation }: TextSelectorProps) {
  const [toolbar, setToolbar] = useState<ToolbarPosition | null>(null)
  const [copied, setCopied] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [activeParagraphIds, setActiveParagraphIds] = useState<string[]>([])
  const [reactionBurst, setReactionBurst] = useState<ReactionBurst | null>(null)
  const activeSelectionNodesRef = useRef<HTMLElement[]>([])
  const preserveSelectionFrameRef = useRef(false)
  const { setReplyingTo, readerId, bookId, chapterId, username, variantType } = useReaderStore()

  const clearSelectionHighlight = useCallback(() => {
    for (const node of activeSelectionNodesRef.current) {
      node.classList.remove('bookstream-selection-frame')
    }
    activeSelectionNodesRef.current = []
  }, [])

  useEffect(() => {
    clearSelectionHighlight()

    if (!containerRef.current || activeParagraphIds.length === 0) {
      return
    }

    const nodes = collectParagraphRangeElements(
      containerRef.current,
      activeParagraphIds[0],
      activeParagraphIds[activeParagraphIds.length - 1],
    )

    for (const node of nodes) {
      node.classList.add('bookstream-selection-frame')
    }
    activeSelectionNodesRef.current = nodes

    return () => {
      for (const node of nodes) {
        node.classList.remove('bookstream-selection-frame')
      }
    }
  }, [activeParagraphIds, containerRef, clearSelectionHighlight])

  useEffect(() => {
    if (!reactionBurst) return

    const timeoutId = window.setTimeout(() => {
      setReactionBurst(null)
    }, 650)

    return () => window.clearTimeout(timeoutId)
  }, [reactionBurst])

  const handleSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !containerRef.current) {
      return
    }

    const range = selection.getRangeAt(0)
    const selectedText = selection.toString().trim()
    if (!selectedText) {
      return
    }

    // Check if selection is within our container
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      return
    }

    // Find the closest paragraph/article element
    const getParagraphArticle = (node: Node): HTMLElement | null => {
      if (node instanceof HTMLElement && node.dataset.paragraphId) {
        return node
      }
      const parent = node.parentNode
      if (!(parent instanceof Element)) return null
      return parent.closest<HTMLElement>('[data-paragraph-id]')
    }

    const startArticle = getParagraphArticle(range.startContainer)
    const endArticle = getParagraphArticle(range.endContainer)
    if (!startArticle || !endArticle) return

    const paragraphArticles = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>('[data-paragraph-id]'),
    )
    const startIndex = paragraphArticles.indexOf(startArticle)
    const endIndex = paragraphArticles.indexOf(endArticle)
    if (startIndex < 0 || endIndex < 0) return

    const [fromIndex, toIndex] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
    const selectedParagraphIds = paragraphArticles.slice(fromIndex, toIndex + 1).map((article) => article.dataset.paragraphId || '')
    if (selectedParagraphIds.length === 0 || selectedParagraphIds.some((id) => !id)) {
      return
    }

    const rect = range.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const toolbarTopAbove = rect.top - TOOLBAR_HEIGHT - TOOLBAR_OFFSET
    const toolbarTopBelow = rect.bottom + TOOLBAR_OFFSET
    const hasRoomAbove = toolbarTopAbove >= TOOLBAR_MARGIN
    const hasRoomBelow = toolbarTopBelow + TOOLBAR_HEIGHT <= viewportHeight - TOOLBAR_MARGIN
    const rawTop = !hasRoomAbove && hasRoomBelow ? toolbarTopBelow : toolbarTopAbove
    const top = clamp(rawTop, TOOLBAR_MARGIN, Math.max(TOOLBAR_MARGIN, viewportHeight - TOOLBAR_HEIGHT - TOOLBAR_MARGIN))
    const left = clamp(
      rect.left + rect.width / 2 - TOOLBAR_WIDTH / 2,
      TOOLBAR_MARGIN,
      Math.max(TOOLBAR_MARGIN, viewportWidth - TOOLBAR_WIDTH - TOOLBAR_MARGIN),
    )

    setToolbar({
      top,
      left,
      selectedText,
      paragraphId: selectedParagraphIds[0],
      endParagraphId: selectedParagraphIds[selectedParagraphIds.length - 1],
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    })
    setActiveParagraphIds(selectedParagraphIds)
  }, [containerRef])

  const clearSelection = useCallback(() => {
    setTimeout(() => {
      const selection = window.getSelection()
      if (selection && selection.isCollapsed) {
        if (preserveSelectionFrameRef.current) {
          preserveSelectionFrameRef.current = false
          setToolbar(null)
          return
        }
        setToolbar(null)
        setActiveParagraphIds([])
      }
    }, 150)
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', handleSelection)
    document.addEventListener('touchend', handleSelection)
    document.addEventListener('mousedown', clearSelection)
    document.addEventListener('touchstart', clearSelection)
    window.addEventListener('scroll', handleSelection, true)
    window.addEventListener('resize', handleSelection)

    return () => {
      document.removeEventListener('mouseup', handleSelection)
      document.removeEventListener('touchend', handleSelection)
      document.removeEventListener('mousedown', clearSelection)
      document.removeEventListener('touchstart', clearSelection)
      window.removeEventListener('scroll', handleSelection, true)
      window.removeEventListener('resize', handleSelection)
    }
  }, [handleSelection, clearSelection])

  const handleReply = () => {
    if (!toolbar) return
    setReplyingTo({
      text: toolbar.selectedText,
      variantType,
      paragraphId: toolbar.paragraphId,
      endParagraphId: toolbar.endParagraphId,
      startOffset: toolbar.startOffset,
      endOffset: toolbar.endOffset,
      selectedText: toolbar.selectedText,
    })
    preserveSelectionFrameRef.current = true
    setToolbar(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleCopy = async () => {
    if (!toolbar) return
    try {
      await navigator.clipboard.writeText(toolbar.selectedText)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setToolbar(null)
      }, 1000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = toolbar.selectedText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setToolbar(null)
      }, 1000)
    }
  }

  const handleAnnotationToggle = async (kind: AnnotationKind, emoji?: string | null) => {
    if (!toolbar || !readerId || !bookId || !chapterId || !username) return

    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          bookId,
          chapterId,
          chapterVariantId: variantId,
          variantType,
          readerId,
          username,
          emoji: emoji || null,
          selection: {
            paragraphId: toolbar.paragraphId,
            endParagraphId: toolbar.endParagraphId,
            selectedText: toolbar.selectedText,
            startOffset: toolbar.startOffset,
            endOffset: toolbar.endOffset,
          },
        }),
      })

      if (!res.ok) {
        return
      }

      const payload = (await res.json()) as {
        action?: string
        annotation?: {
          id: string
          kind: AnnotationKind
          emoji?: string | null
          paragraphId: string
          endParagraphId: string | null
          startOffset: number
          endOffset: number
          selectedText: string | null
          body?: string | null
        }
      }

      const isActive = payload.action !== 'removed'
      preserveSelectionFrameRef.current = isActive

      if (kind === 'reaction' && isActive && emoji) {
        setReactionBurst({
          emoji,
          top: Math.max(8, toolbar.top - 56),
          left: toolbar.left + TOOLBAR_WIDTH / 2 - 16,
        })
      }

      onSelectionAnnotation?.(
        {
          id: payload.annotation?.id,
          kind,
          paragraphId: toolbar.paragraphId,
          endParagraphId: toolbar.endParagraphId,
          startOffset: toolbar.startOffset,
          endOffset: toolbar.endOffset,
          selectedText: toolbar.selectedText,
          emoji: emoji || payload.annotation?.emoji || null,
          body: payload.annotation?.body || null,
        },
        isActive,
      )

      if (!isActive) {
        setActiveParagraphIds([])
      }

      window.dispatchEvent(
        new CustomEvent('bookstream:annotation-updated', {
          detail: {
            kind,
            paragraphId: toolbar.paragraphId,
            endParagraphId: toolbar.endParagraphId,
            chapterVariantId: variantId,
          },
        }),
      )
      window.dispatchEvent(
        new CustomEvent('bookstream:reaction-updated', {
          detail: {
            paragraphId: toolbar.paragraphId,
            endParagraphId: toolbar.endParagraphId,
            chapterVariantId: variantId,
          },
        }),
      )

      setToolbar(null)
      window.getSelection()?.removeAllRanges()
    } catch (e) {
      console.error('Failed to create annotation:', e)
    }
    setEmojiPickerOpen(false)
  }

  if (!toolbar && !reactionBurst) return null

  return (
    <>
      {reactionBurst && (
        <div
          className="selection-reaction-burst"
          style={{
            top: reactionBurst.top,
            left: reactionBurst.left,
          }}
          aria-hidden="true"
        >
          <span>{reactionBurst.emoji}</span>
        </div>
      )}
      {toolbar && (
        <div
          className="selection-toolbar"
          style={{ top: toolbar.top, left: toolbar.left }}
          role="toolbar"
          aria-label="Действия с выделением"
        >
          <ToolbarButton label="Ответить" onClick={handleReply}>
            <Reply size={16} />
          </ToolbarButton>
          <ToolbarButton label={copied ? 'Скопировано' : 'Копировать'} onClick={handleCopy}>
            <Copy size={16} />
          </ToolbarButton>
          <ToolbarButton label="В цитаты" onClick={() => void handleAnnotationToggle('quote')}>
            <Quote size={16} />
          </ToolbarButton>
          <ToolbarButton label="Огонь" onClick={() => void handleAnnotationToggle('reaction', '🔥')}>
            <Flame size={16} />
          </ToolbarButton>
          <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
            <PopoverAnchor asChild>
              <button
                type="button"
                aria-label="Эмодзи"
                aria-haspopup="dialog"
                aria-expanded={emojiPickerOpen}
                title="Эмодзи"
                onClick={() => setEmojiPickerOpen((open) => !open)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <SmilePlus size={16} />
              </button>
            </PopoverAnchor>
            <PopoverContent side="top" align="end" sideOffset={10} className="w-80 p-3">
              <div className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Эмодзи
                </div>
                <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                  {EMOJI_PICKER_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {group.title}
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {group.emojis.map((emoji) => (
                          <button
                            key={`${group.title}-${emoji}`}
                            type="button"
                            className="flex h-10 w-10 items-center justify-center rounded-md text-xl transition-colors hover:bg-accent hover:text-accent-foreground"
                            aria-label={`Поставить реакцию ${emoji}`}
                            title={emoji}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => void handleAnnotationToggle('reaction', emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </>
  )
}
