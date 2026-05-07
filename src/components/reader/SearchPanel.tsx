'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'

interface SearchPanelProps {
  open: boolean
  onClose: () => void
  contentRef: React.RefObject<HTMLDivElement | null>
}

const HIGHLIGHT_CLASS = 'bookstream-search-highlight'
const CURRENT_CLASS = 'bookstream-search-current'

export default function SearchPanel({ open, onClose, contentRef }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [currentIdx, setCurrentIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const matchNodesRef = useRef<Element[]>([])
  const isSearchingRef = useRef(false)

  // DOM-only highlight cleanup (no setState)
  const clearHighlightsDOM = useCallback(() => {
    if (!contentRef.current) return
    const container = contentRef.current

    container.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
      const parent = el.parentNode
      if (!parent) return
      const text = document.createTextNode(el.textContent || '')
      parent.replaceChild(text, el)
      parent.normalize()
    })

    matchNodesRef.current = []
  }, [contentRef])

  // Full clear: DOM + state (for use in event handlers only)
  const clearHighlights = useCallback(() => {
    clearHighlightsDOM()
    setMatchCount(0)
    setCurrentIdx(0)
  }, [clearHighlightsDOM])

  // Recursively walk text nodes and highlight matching text
  const highlightTextNode = useCallback(
    (textNode: Text, searchStr: string) => {
      const text = textNode.nodeValue || ''
      const lowerText = text.toLowerCase()
      const lowerSearch = searchStr.toLowerCase()

      if (!lowerSearch || lowerText.length === 0) return

      const fragments: Array<{ type: 'text' | 'match'; value: string }> = []
      let idx = 0

      while (idx < lowerText.length) {
        const foundAt = lowerText.indexOf(lowerSearch, idx)
        if (foundAt === -1) {
          fragments.push({ type: 'text', value: text.slice(idx) })
          break
        }
        if (foundAt > idx) {
          fragments.push({ type: 'text', value: text.slice(idx, foundAt) })
        }
        fragments.push({ type: 'match', value: text.slice(foundAt, foundAt + searchStr.length) })
        idx = foundAt + searchStr.length
      }

      if (fragments.length <= 1) return
      if (fragments.every((f) => f.type === 'text')) return

      const parent = textNode.parentNode
      if (!parent) return

      const frag = document.createDocumentFragment()
      for (const f of fragments) {
        if (f.type === 'text') {
          frag.appendChild(document.createTextNode(f.value))
        } else {
          const span = document.createElement('span')
          span.className = HIGHLIGHT_CLASS
          span.textContent = f.value
          frag.appendChild(span)
        }
      }

      parent.replaceChild(frag, textNode)
    },
    [],
  )

  // Navigate to a specific match and scroll it into view
  const navigateToMatch = useCallback(
    (idx: number) => {
      const highlights = matchNodesRef.current
      if (highlights.length === 0) return

      const safeIdx = Math.max(1, Math.min(idx, highlights.length))

      highlights.forEach((el) => el.classList.remove(CURRENT_CLASS))

      const target = highlights[safeIdx - 1]
      target.classList.add(CURRENT_CLASS)

      setCurrentIdx(safeIdx)
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    [],
  )

  // Walk the DOM tree and highlight all matches
  const performSearch = useCallback(
    (searchStr: string, goToIndex?: number) => {
      clearHighlightsDOM()
      setMatchCount(0)
      setCurrentIdx(0)

      if (!contentRef.current || !searchStr.trim()) {
        return
      }

      const container = contentRef.current

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node.parentElement
          if (parent && (parent.closest(`.${HIGHLIGHT_CLASS}`) || parent.closest('script, style, [contenteditable]'))) {
            return NodeFilter.FILTER_REJECT
          }
          if (node.nodeValue?.trim() === '') return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        },
      })

      const textNodes: Text[] = []
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode as Text)
      }

      for (const tn of textNodes) {
        highlightTextNode(tn, searchStr)
      }

      const highlights = Array.from(container.querySelectorAll(`.${HIGHLIGHT_CLASS}`))
      matchNodesRef.current = highlights
      setMatchCount(highlights.length)

      const targetIdx = goToIndex ?? (highlights.length > 0 ? 1 : 0)
      if (highlights.length > 0) {
        navigateToMatch(targetIdx)
      }
    },
    [clearHighlightsDOM, highlightTextNode, contentRef, navigateToMatch],
  )

  // Handle search input change
  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (value.trim()) {
        isSearchingRef.current = true
        requestAnimationFrame(() => {
          performSearch(value, 1)
          isSearchingRef.current = false
        })
      } else {
        clearHighlights()
      }
    },
    [performSearch, clearHighlights],
  )

  // Go to previous match
  const goPrev = useCallback(() => {
    if (matchNodesRef.current.length === 0) return
    const nextIdx = currentIdx <= 1 ? matchNodesRef.current.length : currentIdx - 1
    navigateToMatch(nextIdx)
  }, [currentIdx, navigateToMatch])

  // Go to next match
  const goNext = useCallback(() => {
    if (matchNodesRef.current.length === 0) return
    const nextIdx = currentIdx >= matchNodesRef.current.length ? 1 : currentIdx + 1
    navigateToMatch(nextIdx)
  }, [currentIdx, navigateToMatch])

  // Close handler: clear everything before calling onClose
  const handleClose = useCallback(() => {
    setQuery('')
    clearHighlights()
    onClose()
  }, [clearHighlights, onClose])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleClose()
        return
      }

      if (e.key === 'Enter' && !isSearchingRef.current) {
        e.preventDefault()
        e.stopPropagation()
        if (e.shiftKey) {
          goPrev()
        } else {
          goNext()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, handleClose, goPrev, goNext])

  // Focus input when opened (pure DOM side-effect, no setState)
  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [open])

  // Clear DOM highlights when panel closes (pure DOM side-effect, no setState)
  useEffect(() => {
    if (open) return
    clearHighlightsDOM()
  }, [open, clearHighlightsDOM])

  // Inject highlight styles
  useEffect(() => {
    const id = 'bookstream-search-highlight-styles'
    if (document.getElementById(id)) return

    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        background-color: rgba(250, 204, 21, 0.35);
        border-radius: 2px;
        padding: 1px 0;
        transition: background-color 0.15s ease;
      }
      .${CURRENT_CLASS} {
        background-color: rgba(250, 204, 21, 0.75) !important;
        outline: 2px solid rgba(234, 179, 8, 0.6);
        outline-offset: 1px;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.getElementById(id)?.remove()
    }
  }, [])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Поиск по тексту"
      style={{
        position: 'fixed',
        top: '0.75rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        width: 'calc(100% - 2rem)',
        maxWidth: '500px',
        backgroundColor: 'var(--r-bg)',
        border: '1px solid var(--r-border)',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15), 0 1px 4px rgba(0, 0, 0, 0.08)',
        padding: '0.625rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      {/* Search icon */}
      <Search
        size={16}
        style={{
          flexShrink: 0,
          color: 'var(--r-text-secondary)',
          marginLeft: '0.25rem',
        }}
        aria-hidden="true"
      />

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Поиск по тексту..."
        aria-label="Поиск по тексту"
        style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--r-text)',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          padding: '0.375rem 0',
        }}
      />

      {/* Match count */}
      {matchCount > 0 && (
        <span
          style={{
            flexShrink: 0,
            fontSize: '0.75rem',
            color: 'var(--r-text-secondary)',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
          aria-live="polite"
        >
          {currentIdx} / {matchCount}
        </span>
      )}

      {/* Navigation buttons */}
      {matchCount > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
          <button
            onClick={goPrev}
            aria-label="Предыдущее совпадение"
            style={navButtonStyle}
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={goNext}
            aria-label="Следующее совпадение"
            style={navButtonStyle}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      )}

      {/* Close button */}
      <button
        onClick={handleClose}
        aria-label="Закрыть поиск"
        style={{
          flexShrink: 0,
          width: '36px',
          height: '36px',
          minWidth: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '0.5rem',
          border: 'none',
          backgroundColor: 'var(--r-bg-secondary)',
          color: 'var(--r-text-secondary)',
          cursor: 'pointer',
          transition: 'background-color 0.15s ease, color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--r-border)'
          e.currentTarget.style.color = 'var(--r-text)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--r-bg-secondary)'
          e.currentTarget.style.color = 'var(--r-text-secondary)'
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

const navButtonStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  minWidth: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '0.5rem',
  border: 'none',
  backgroundColor: 'var(--r-bg-secondary)',
  color: 'var(--r-text-secondary)',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease, color 0.15s ease',
}
