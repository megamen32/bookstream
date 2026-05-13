'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BibliographyItem } from '@/lib/books/annotations'

interface AnnotationPopoverProps {
  open: boolean
  anchorRect: DOMRect | null
  items: BibliographyItem[]
  onOpenChange: (open: boolean) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export default function AnnotationPopover({
  open,
  anchorRect,
  items,
  onOpenChange,
}: AnnotationPopoverProps) {
  const [mounted, setMounted] = useState(false)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    const updateViewport = (): void => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) {
        onOpenChange(false)
        return
      }

      if (target.closest('.book-annotation-popover, .book-annotation-marker')) {
        return
      }

      onOpenChange(false)
    }

    window.addEventListener('keydown', handleEscape)
    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onOpenChange, open])

  const layout = useMemo(() => {
    if (!anchorRect) {
      return null
    }

    const isMobile = viewport.width > 0 && viewport.width < 768
    if (isMobile) {
      return {
        position: 'fixed' as const,
        left: '50%',
        right: 'auto',
        bottom: 'max(0.9rem, env(safe-area-inset-bottom))',
        top: 'auto',
        transform: 'translateX(-50%)',
        width: 'min(calc(100vw - 1.2rem), 520px)',
      }
    }

    const preferredWidth = Math.min(520, Math.max(320, viewport.width - 24))
    const aboveTop = anchorRect.top - 14
    const belowTop = anchorRect.bottom + 14
    const placeAbove = aboveTop > viewport.height * 0.5
    const width = preferredWidth
    const left = clamp(anchorRect.left, 12, Math.max(12, viewport.width - width - 12))
    const top = placeAbove
      ? Math.max(12, aboveTop - 8)
      : Math.min(Math.max(12, belowTop), Math.max(12, viewport.height - 12))

    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      transform: placeAbove ? 'translateY(-100%)' : 'none',
      width: `${width}px`,
    }
  }, [anchorRect, viewport.height, viewport.width])

  if (!mounted || !open || !items.length || !layout) {
    return null
  }

  const title = items.length > 1 ? 'Источники' : 'Источник'

  return createPortal(
    <div className="book-annotation-popover" style={layout} role="dialog" aria-label={title}>
      <div className="book-annotation-popover__inner">
        <div className="book-annotation-popover__title">{title}</div>

        <div className="book-annotation-popover__list">
          {items.map((item) => (
            <div key={item.number} className="book-annotation-popover__item">
              <div className="book-annotation-popover__number">{item.number}.</div>
              <div className="book-annotation-popover__text">{item.rawText}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
