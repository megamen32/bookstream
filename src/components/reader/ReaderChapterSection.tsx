'use client'

import type React from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import ReactionBar from './ReactionBar'
import ChapterAfterword from './ChapterAfterword'
import type { AnnotationParagraphRange } from '@/lib/annotations'
import { splitTextByAnnotationRanges } from '@/lib/annotations'
import type { FeedSectionData } from './feed-types'
import type { ReaderComment } from './comment-types'
import { renderTextWithBibliographyMarkers } from './bibliography-render'

interface ReaderChapterSectionProps {
  section: FeedSectionData
  isActiveSection: boolean
  isInitialReveal: boolean
  bookId: string
  contentMaxWidth: string
  fontSize: number
  lineHeight: number
  lineWidth: 'narrow' | 'medium' | 'wide'
  bookmarkedKeys: Record<string, string | undefined>
  onToggleBookmark?: (chapterId: string, stableKey: string) => void
  authorSlug: string
  bookSlug: string
  showCommentsAfterChapter: boolean
  showReactionBar: boolean
  showMobileReactionBar: boolean
  highlightParagraphId?: string | null
  hasPreciseQuoteHighlight?: boolean
  composerOpenChapterId?: string | null
  composerOpenRequest?: number
  onSendComment?: (body: string) => Promise<ReaderComment | null>
  getTextRangesForParagraph: (chapterId: string, paragraphId: string) => AnnotationParagraphRange[]
}

/**
 * Renders a single feed chapter inside the virtual viewport.
 */
export default function ReaderChapterSection({
  section,
  isActiveSection,
  isInitialReveal,
  bookId,
  contentMaxWidth,
  fontSize,
  lineHeight,
  lineWidth,
  bookmarkedKeys,
  onToggleBookmark,
  authorSlug,
  bookSlug,
  showCommentsAfterChapter,
  showReactionBar,
  showMobileReactionBar,
  highlightParagraphId,
  hasPreciseQuoteHighlight = false,
  composerOpenChapterId,
  composerOpenRequest = 0,
  onSendComment,
  getTextRangesForParagraph,
}: ReaderChapterSectionProps) {
  const bookmarkedKey = bookmarkedKeys[section.chapter.id] || null

  const handleBookmarkClick = (
    event: React.MouseEvent,
    chapterId: string,
    stableKey: string,
  ): void => {
    event.stopPropagation()
    onToggleBookmark?.(chapterId, stableKey)
  }

  return (
    <div
      data-chapter-id={section.chapter.id}
      data-variant-id={section.variant.id}
      data-variant-type={section.variant.variantType}
      className={`feed-section${isActiveSection ? ' is-active' : ''}${isInitialReveal ? ' is-initial-reveal' : ''}`}
      style={{
        maxWidth: contentMaxWidth,
        margin: '0 auto',
      }}
    >
      <div className="feed-chapter-header">
        <div className="feed-chapter-header__eyebrow">
          Глава {section.chapter.position + 1}
        </div>

        <h1 className="feed-chapter-header__title">
          {section.chapter.title}
        </h1>

        <div className="feed-chapter-header__rule" aria-hidden="true">
          <span className="feed-chapter-header__rule-line" />
          <span className="feed-chapter-header__rule-dot" />
          <span className="feed-chapter-header__rule-line" />
        </div>
      </div>

      <div
        className="reader-content feed-reader-content"
        data-line-width={lineWidth}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: `${lineHeight}`,
          margin: '0 auto',
        }}
      >
        {section.variant.paragraphs.map((paragraph) => {
          const isQuoteTarget = highlightParagraphId === paragraph.id && !hasPreciseQuoteHighlight
          const ranges = getTextRangesForParagraph(section.chapter.id, paragraph.id)
          const hasSelectionHighlight = ranges.length > 0
          const textSegments = splitTextByAnnotationRanges(paragraph.text, ranges)
          const canRenderRichParagraph = !hasSelectionHighlight && Boolean(paragraph.html)

          return (
            <div
              key={paragraph.stableKey || paragraph.id}
              className={`feed-paragraph group${hasSelectionHighlight ? ' has-selection-highlight' : ''}${isQuoteTarget ? ' is-quote-target' : ''}`}
            >
              {isQuoteTarget ? (
                <span className="feed-paragraph__quote-badge">
                  Цитата
                </span>
              ) : null}

              <article
                data-paragraph-id={paragraph.id}
                data-stable-key={paragraph.stableKey}
                className="feed-paragraph__article"
              >
                <button
                  onClick={(event) => handleBookmarkClick(event, section.chapter.id, paragraph.stableKey)}
                  title={bookmarkedKey === paragraph.stableKey ? 'Убрать закладку' : 'Поставить закладку'}
                  className={`feed-paragraph__bookmark${bookmarkedKey === paragraph.stableKey ? ' is-active' : ''}`}
                >
                  {bookmarkedKey === paragraph.stableKey
                    ? <BookmarkCheck size={16} />
                    : <Bookmark size={16} />}
                </button>

                {canRenderRichParagraph ? (
                  <p
                    style={{
                      margin: 0,
                      textAlign: paragraph.textAlign ?? undefined,
                      paddingInlineStart: paragraph.indentPx
                        ? `${Math.min(paragraph.indentPx, 160)}px`
                        : undefined,
                    }}
                    dangerouslySetInnerHTML={{ __html: paragraph.html || '' }}
                  />
                ) : (
                  <p
                    style={{
                      margin: 0,
                      textAlign: paragraph.textAlign ?? undefined,
                      paddingInlineStart: paragraph.indentPx
                        ? `${Math.min(paragraph.indentPx, 160)}px`
                        : undefined,
                    }}
                  >
                    {textSegments.map((segment, index) => (
                      segment.highlighted ? (
                        <span
                          key={`${paragraph.id}-hl-${index}`}
                          className="bookstream-inline-annotation"
                        >
                          <span className="bookstream-word-highlight">
                            {renderTextWithBibliographyMarkers(segment.text, `${paragraph.id}-hl-${index}`)}
                          </span>

                          {segment.badges.map((badge, badgeIndex) => (
                            <span
                              key={`${paragraph.id}-badge-${index}-${badgeIndex}-${badge.kind}-${badge.emoji || badge.badgeLabel}`}
                              className="bookstream-inline-annotation-badge"
                              data-kind={badge.kind}
                              title={
                                badge.kind === 'reaction'
                                  ? 'Вы поставили реакцию'
                                  : badge.kind === 'quote'
                                    ? 'Вы вынесли цитату'
                                    : 'Вы оставили комментарий'
                              }
                            >
                              {badge.kind === 'reaction'
                                ? badge.emoji || '•'
                                : badge.kind === 'quote'
                                  ? '»'
                                  : '✎'}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span key={`${paragraph.id}-txt-${index}`}>
                          {renderTextWithBibliographyMarkers(segment.text, `${paragraph.id}-txt-${index}`)}
                        </span>
                      )
                    ))}
                  </p>
                )}
              </article>

      {showReactionBar ? (
        <ReactionBar
          paragraphId={paragraph.id}
          variantId={section.variant.id}
          chapterId={section.chapter.id}
          variantType={section.variant.variantType}
          showOnMobile={showMobileReactionBar}
        />
      ) : null}
            </div>
          )
        })}
      </div>

      <ChapterAfterword
        chapterId={section.chapter.id}
        chapterTitle={section.chapter.title}
        bookId={bookId}
        authorSlug={authorSlug}
        bookSlug={bookSlug}
        preview={section.preview}
        showCommentsAfterChapter={showCommentsAfterChapter}
        composerOpenChapterId={composerOpenChapterId === section.chapter.id ? section.chapter.id : null}
        composerOpenRequest={composerOpenRequest}
        onSendComment={onSendComment}
      />

      <div className="feed-chapter-footer">
        <span className="feed-chapter-footer__label">
          {section.nextChapterId ? 'Следующая глава ниже' : 'Конец книги'}
        </span>
      </div>
    </div>
  )
}
