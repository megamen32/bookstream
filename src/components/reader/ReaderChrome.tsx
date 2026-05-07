'use client'

import type React from 'react'
import {
  AlignJustify,
  BookOpen,
  ChevronLeft,
  ChevronDown,
  Clock3,
  List,
  MessageSquare,
  Search,
  Settings2,
  Sparkles,
  StretchHorizontal,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import VariantSlider from './VariantSlider'
import type { ReadingMode } from '@/lib/store'
import type { VariantType } from '@/lib/store'

export type ReaderChromeOverlay =
  | 'none'
  | 'quick-actions'
  | 'toc'
  | 'activity'
  | 'search'
  | 'settings'
  | 'comments'

interface VariantPresetMeta {
  id?: string
  label: string
  emoji: string
  description?: string
  targetSizePercent?: number | null
  position?: number
}

interface ReaderChromeProps {
  visible: boolean
  activeOverlay: ReaderChromeOverlay
  bookTitle: string
  chapterTitle: string
  progressPercent: number
  readingMode: ReadingMode
  hasBookmark: boolean
  variantsExpanded: boolean
  generatedVariants: string[]
  variantPresets: Record<string, VariantPresetMeta>
  generatingVariant?: string | null
  onBack: () => void
  onClose: () => void
  onOpenTOC: () => void
  onOpenActivity: () => void
  onOpenComments: () => void
  onToggleQuickActions: () => void
  onOpenSearch: () => void
  onOpenSettings: () => void
  onToggleVariants: (open: boolean) => void
  onVariantChange: (type: VariantType) => void
  onToggleReadingMode: () => void
  onGoToBookmark: () => void
}

interface CornerButtonProps {
  active?: boolean
  disabled?: boolean
  label: string
  onClick: () => void
  icon: React.ReactNode
}

interface QuickActionProps {
  icon: React.ReactNode
  title: string
  description: string
  disabled?: boolean
  onClick: () => void
}

const MODE_LABELS: Record<ReadingMode, string> = {
  feed: 'Лента',
  book: 'Книга',
}

function CornerButton({
  active = false,
  disabled = false,
  label,
  onClick,
  icon,
}: CornerButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      className={`reader-chrome__corner-button${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      data-reader-ignore-chrome="true"
    >
      <span className="reader-chrome__corner-icon">{icon}</span>
      <span className="reader-chrome__corner-label">{label}</span>
    </button>
  )
}

function QuickAction({
  icon,
  title,
  description,
  disabled = false,
  onClick,
}: QuickActionProps): React.ReactElement {
  return (
    <button
      type="button"
      className="reader-chrome__action"
      onClick={onClick}
      disabled={disabled}
      data-reader-ignore-chrome="true"
    >
      <span className="reader-chrome__action-icon">{icon}</span>
      <span className="reader-chrome__action-copy">
        <span className="reader-chrome__action-title">{title}</span>
        <span className="reader-chrome__action-description">{description}</span>
      </span>
    </button>
  )
}

export default function ReaderChrome({
  visible,
  activeOverlay,
  bookTitle,
  chapterTitle,
  progressPercent,
  readingMode,
  hasBookmark,
  variantsExpanded,
  generatedVariants,
  variantPresets,
  generatingVariant = null,
  onBack,
  onClose,
  onOpenTOC,
  onOpenActivity,
  onOpenComments,
  onToggleQuickActions,
  onOpenSearch,
  onOpenSettings,
  onToggleVariants,
  onVariantChange,
  onToggleReadingMode,
  onGoToBookmark,
}: ReaderChromeProps): React.ReactElement | null {
  if (!visible) {
    return null
  }

  return (
    <>
      {readingMode === 'book' ? (
        <button
          type="button"
          className="reader-chrome__backdrop"
          aria-label="Скрыть элементы интерфейса"
          onClick={onClose}
        />
      ) : null}

      <div
        className="reader-chrome"
        data-overlay={activeOverlay}
      >
        <div className="reader-chrome__top-left" data-reader-ignore-chrome="true">
          <div className="reader-chrome__meta-pill">
            <button
              type="button"
              className="reader-chrome__back-button"
              onClick={onBack}
              aria-label="Назад к книге"
              data-reader-ignore-chrome="true"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="reader-chrome__meta-copy">
              <div className="reader-chrome__book-title" title={bookTitle}>
                {bookTitle}
              </div>
              <div className="reader-chrome__chapter-title" title={chapterTitle}>
                {chapterTitle}
              </div>
              <div className="reader-chrome__meta-footer">
                <span className="reader-chrome__mode-badge">
                  {MODE_LABELS[readingMode]}
                </span>

                <div className="reader-chrome__progress-track" aria-hidden="true">
                  <div
                    className="reader-chrome__progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <span className="reader-chrome__progress-label">
                  {progressPercent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="reader-chrome__bottom reader-chrome__bottom-left" data-reader-ignore-chrome="true">
          <CornerButton
            active={activeOverlay === 'toc'}
            label="Оглавление"
            onClick={onOpenTOC}
            icon={<List size={18} />}
          />
          <CornerButton
            active={activeOverlay === 'activity'}
            label="Активность"
            onClick={onOpenActivity}
            icon={<Clock3 size={18} />}
          />
        </div>

        <div className="reader-chrome__progress-pill" data-reader-ignore-chrome="true">
          <span className="reader-chrome__progress-value">{progressPercent}%</span>
          <span className="reader-chrome__progress-dot" />
          <span className="reader-chrome__progress-mode">{MODE_LABELS[readingMode]}</span>
        </div>

        <div className="reader-chrome__bottom reader-chrome__bottom-right" data-reader-ignore-chrome="true">
          <CornerButton
            active={activeOverlay === 'comments'}
            label="Комментарии"
            onClick={onOpenComments}
            icon={<MessageSquare size={18} />}
          />
          <CornerButton
            active={activeOverlay === 'quick-actions'}
            label="Ещё"
            onClick={onToggleQuickActions}
            icon={<Sparkles size={18} />}
          />
        </div>

        {activeOverlay === 'quick-actions' ? (
          <div className="reader-chrome__quick-actions" data-reader-ignore-chrome="true">
            <QuickAction
              icon={<Search size={17} />}
              title="Поиск по тексту"
              description="Найти фразу в текущем тексте"
              onClick={onOpenSearch}
            />
            <Collapsible open={variantsExpanded} onOpenChange={onToggleVariants}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={`reader-chrome__action${variantsExpanded ? ' is-expanded' : ''}`}
                  data-reader-ignore-chrome="true"
                >
                  <span className="reader-chrome__action-icon">
                    <StretchHorizontal size={17} />
                  </span>
                  <span className="reader-chrome__action-copy">
                    <span className="reader-chrome__action-title">Версии текста</span>
                    <span className="reader-chrome__action-description">
                      Показать оригинал и сжатые варианты
                    </span>
                  </span>
                  <span className="reader-chrome__action-chevron" aria-hidden="true">
                    <ChevronDown size={16} />
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="reader-chrome__action-variants">
                  <VariantSlider
                    layout="stacked"
                    onVariantChange={onVariantChange}
                    generatedVariants={generatedVariants}
                    variantPresets={variantPresets}
                    generatingVariant={generatingVariant}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
            <QuickAction
              icon={readingMode === 'feed' ? <BookOpen size={17} /> : <AlignJustify size={17} />}
              title={readingMode === 'feed' ? 'Переключить в книгу' : 'Переключить в ленту'}
              description="Сменить способ чтения главы"
              onClick={onToggleReadingMode}
            />
            <QuickAction
              icon={<Sparkles size={17} />}
              title="К закладке"
              description={hasBookmark ? 'Перейти к сохранённому месту' : 'Сначала поставьте закладку в тексте'}
              disabled={!hasBookmark}
              onClick={onGoToBookmark}
            />
            <QuickAction
              icon={<Settings2 size={17} />}
              title="Настройки"
              description="Шрифт, тема, ширина строки"
              onClick={onOpenSettings}
            />
          </div>
        ) : null}
      </div>
    </>
  )
}
