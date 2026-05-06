'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useReaderStore } from '@/lib/store'

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

export default function TextSelector({ containerRef, variantId }: TextSelectorProps) {
  const [toolbar, setToolbar] = useState<ToolbarPosition | null>(null)
  const [copied, setCopied] = useState(false)
  const { setReplyingTo, readerId, bookId } = useReaderStore()
  const observerRef = useRef<MutationObserver | null>(null)

  const handleSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !containerRef.current) {
      return
    }

    const range = selection.getRangeAt(0)
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
    const containerRect = containerRef.current.getBoundingClientRect()

    setToolbar({
      top: rect.top - containerRect.top - 50,
      left: Math.max(0, Math.min(rect.left - containerRect.left + rect.width / 2 - 100, containerRect.width - 220)),
      selectedText: selection.toString().trim(),
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

    return () => {
      document.removeEventListener('mouseup', handleSelection)
      document.removeEventListener('touchend', handleSelection)
      document.removeEventListener('mousedown', clearSelection)
      document.removeEventListener('touchstart', clearSelection)
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
      await fetch('/api/comments/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paragraphId: toolbar.paragraphId,
          chapterVariantId: variantId,
          readerId,
          emoji,
        }),
      })
    } catch (e) {
      console.error('Failed to react:', e)
    }
    setToolbar(null)
    window.getSelection()?.removeAllRanges()
  }

  if (!toolbar) return null

  return (
    <div
      className="selection-toolbar"
      style={{ top: toolbar.top, left: toolbar.left }}
    >
      <button onClick={handleReply} title="Ответить">
        💬 Ответить
      </button>
      <button onClick={handleCopy} title="Копировать">
        {copied ? '✓ Скопировано' : '📋 Копировать'}
      </button>
      <button onClick={() => handleReact('⭐')} title="В цитаты">
        ⭐ В цитаты
      </button>
      <button onClick={() => handleReact('🔥')} title="Огонь">
        🔥
      </button>
      <button onClick={() => handleReact('😂')} title="Смешно">
        😂
      </button>
    </div>
  )
}
