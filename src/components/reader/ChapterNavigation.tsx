'use client'

import { ChevronLeft, ChevronRight, List } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Chapter {
  id: string
  title: string
  position: number
}

interface ChapterNavigationProps {
  chapters: Chapter[]
  currentChapterId: string
  onChapterChange: (chapterId: string) => void
  theme: 'light' | 'sepia' | 'dark' | 'oled'
}

export default function ChapterNavigation({
  chapters,
  currentChapterId,
  onChapterChange,
}: ChapterNavigationProps) {
  const currentIndex = chapters.findIndex(c => c.id === currentChapterId)
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null
  const currentChapter = chapters[currentIndex]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      {/* Prev */}
      <button
        onClick={() => prevChapter && onChapterChange(prevChapter.id)}
        disabled={!prevChapter}
        style={{
          background: 'none',
          border: 'none',
          cursor: prevChapter ? 'pointer' : 'default',
          color: prevChapter ? 'var(--r-text)' : 'var(--r-text-secondary)',
          padding: '0.5rem',
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: prevChapter ? 1 : 0.4,
        }}
        title={prevChapter ? prevChapter.title : 'Нет предыдущей главы'}
      >
        <ChevronLeft size={20} />
      </button>

      {/* Chapter dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--r-text)',
              padding: '0.5rem 0.375rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              maxWidth: '10rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <List size={14} />
            <span>
              {currentChapter?.title || `Глава ${currentIndex + 1}`}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            backgroundColor: 'var(--r-bg)',
            border: '1px solid var(--r-border)',
          }}
        >
          {chapters.map((chapter) => (
            <DropdownMenuItem
              key={chapter.id}
              onClick={() => onChapterChange(chapter.id)}
              style={{
                backgroundColor: chapter.id === currentChapterId ? 'var(--r-bg-secondary)' : undefined,
                color: 'var(--r-text)',
                fontSize: '0.8125rem',
                minHeight: '44px',
              }}
            >
              <span style={{ color: 'var(--r-text-secondary)', marginRight: '0.5rem', fontSize: '0.75rem' }}>
                {chapter.position}.
              </span>
              {chapter.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Next */}
      <button
        onClick={() => nextChapter && onChapterChange(nextChapter.id)}
        disabled={!nextChapter}
        style={{
          background: 'none',
          border: 'none',
          cursor: nextChapter ? 'pointer' : 'default',
          color: nextChapter ? 'var(--r-text)' : 'var(--r-text-secondary)',
          padding: '0.5rem',
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: nextChapter ? 1 : 0.4,
        }}
        title={nextChapter ? nextChapter.title : 'Нет следующей главы'}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
