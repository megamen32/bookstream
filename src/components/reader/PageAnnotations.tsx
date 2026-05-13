'use client'

import type { BibliographyItem } from '@/lib/books/annotations'

interface PageAnnotationsProps {
  items: BibliographyItem[]
}

export default function PageAnnotations({ items }: PageAnnotationsProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <aside className="book-page-annotations" aria-label="Источники на странице">
      <div className="book-page-annotations__rule" />
      <div className="book-page-annotations__list">
        {items.map((item) => (
          <div key={item.number} className="book-page-annotations__item">
            <span className="book-page-annotations__number">{item.number}.</span>
            <span className="book-page-annotations__text">{item.rawText}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

