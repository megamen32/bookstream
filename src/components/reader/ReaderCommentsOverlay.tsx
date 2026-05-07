'use client'

import type React from 'react'
import { MessageSquare, X } from 'lucide-react'
import CommentsSection from './CommentsSection'
import type { CommentSubmitHandler } from './comment-types'

interface ReaderCommentsOverlayProps {
  open: boolean
  chapterId: string | null
  chapterTitle: string
  onOpenChange: (open: boolean) => void
  onSendComment: CommentSubmitHandler
  commentsSectionRef?: React.RefObject<HTMLDivElement | null>
  authorSlug: string
  bookSlug: string
}

export default function ReaderCommentsOverlay({
  open,
  chapterId,
  chapterTitle,
  onOpenChange,
  onSendComment,
  commentsSectionRef,
  authorSlug,
  bookSlug,
}: ReaderCommentsOverlayProps): React.ReactElement | null {
  if (!open || !chapterId) {
    return null
  }

  return (
    <div className="reader-comments-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="reader-comments-overlay__backdrop"
        onClick={() => onOpenChange(false)}
        aria-label="Закрыть комментарии"
      />

      <div className="reader-comments-overlay__panel">
        <div className="reader-comments-overlay__drag" aria-hidden="true">
          <span className="reader-comments-overlay__handle" />
        </div>

        <div className="reader-comments-overlay__header">
          <div className="reader-comments-overlay__copy">
            <div className="reader-comments-overlay__eyebrow">
              <MessageSquare size={15} />
              Обсуждение главы
            </div>
            <div className="reader-comments-overlay__title">
              {chapterTitle}
            </div>
          </div>

          <button
            type="button"
            className="reader-comments-overlay__close"
            onClick={() => onOpenChange(false)}
            aria-label="Закрыть комментарии"
          >
            <X size={18} />
          </button>
        </div>

        <div className="reader-comments-overlay__body">
          <CommentsSection
            chapterId={chapterId}
            onSendComment={onSendComment}
            sectionRef={commentsSectionRef}
            authorSlug={authorSlug}
            bookSlug={bookSlug}
          />
        </div>
      </div>
    </div>
  )
}
