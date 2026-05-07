'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Copy, Flame, Quote, Reply, SmilePlus } from 'lucide-react'
import { useReaderStore } from '@/lib/store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'

interface TextSelectorProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  variantId: string
}

interface ToolbarPosition {
  top: number
  left: number
  selectedText: string
  paragraphId: string
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

function ToolbarButton({ label, onClick, children }: ToolbarButtonProps): JSX.Element {
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

export default function TextSelector({ containerRef, variantId }: TextSelectorProps) {
  const [toolbar, setToolbar] = useState<ToolbarPosition | null>(null)
  const [copied, setCopied] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const { setReplyingTo, readerId, bookId } = useReaderStore()

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
    let node = range.startContainer as HTMLElement
    while (node && node !== containerRef.current) {
      if (node.dataset && node.dataset.stableKey) {
        break
      }
      node = node.parentElement as HTMLElement
    }

    if (!node || node === containerRef.current) return

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
      paragraphId: (node as HTMLElement).dataset.paragraphId || (node as HTMLElement).dataset.stableKey || '',
    })
  }, [containerRef])

  const clearSelection = useCallback(() => {
    setTimeout(() => {
      const selection = window.getSelection()
      if (selection && selection.isCollapsed) {
        setToolbar(null)
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
      variantType: useReaderStore.getState().variantType,
      paragraphId: toolbar.paragraphId,
    })
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

  const handleReact = async (emoji: string) => {
    if (!toolbar || !readerId || !bookId) return
    try {
      const res = await fetch('/api/comments/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paragraphId: toolbar.paragraphId,
          chapterVariantId: variantId,
          readerId,
          emoji,
        }),
      })
      if (res.ok) {
        window.dispatchEvent(
          new CustomEvent('bookstream:reaction-updated', {
            detail: {
              paragraphId: toolbar.paragraphId,
              chapterVariantId: variantId,
            },
          }),
        )
      }
    } catch (e) {
      console.error('Failed to react:', e)
    }
    setEmojiPickerOpen(false)
    setToolbar(null)
    window.getSelection()?.removeAllRanges()
  }

  if (!toolbar) return null

  return (
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
      <ToolbarButton label="В цитаты" onClick={() => handleReact('⭐')}>
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton label="Огонь" onClick={() => handleReact('🔥')}>
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
                        onClick={() => void handleReact(emoji)}
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
  )
}
