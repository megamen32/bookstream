'use client'

import type { ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

export interface BookMetadataSectionProps {
  title?: string
  description?: string
  idPrefix?: string
  titleValue: string
  onTitleChange: (value: string) => void
  slugValue: string
  onSlugChange: (value: string) => void
  slugLabel?: string
  slugPreview?: string
  slugHelperText?: string
  descriptionValue: string
  onDescriptionChange: (value: string) => void
  readingMode: string
  onReadingModeChange: (value: string) => void
  isPublic?: boolean
  onIsPublicChange?: (value: boolean) => void
  showVisibility?: boolean
  visibilityNote?: string
  disabled?: boolean
  beforeFields?: ReactNode
}

/**
 * Renders the shared admin fields for editable book metadata.
 *
 * @param props Field values, handlers and optional extra content.
 * @returns Metadata card reused across admin screens.
 */
export function BookMetadataSection({
  title = 'Информация о книге',
  description,
  idPrefix = 'book-metadata',
  titleValue,
  onTitleChange,
  slugValue,
  onSlugChange,
  slugLabel = 'Slug *',
  slugPreview,
  slugHelperText,
  descriptionValue,
  onDescriptionChange,
  readingMode,
  onReadingModeChange,
  isPublic,
  onIsPublicChange,
  showVisibility = false,
  visibilityNote,
  disabled = false,
  beforeFields,
}: BookMetadataSectionProps) {
  const titleId = `${idPrefix}-title`
  const slugId = `${idPrefix}-slug`
  const descriptionId = `${idPrefix}-description`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {beforeFields}

        <div className="space-y-2">
          <Label htmlFor={titleId}>Название *</Label>
          <Input
            id={titleId}
            value={titleValue}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Название книги..."
            disabled={disabled}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={slugId}>{slugLabel}</Label>
          {slugPreview ? (
            <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Предпросмотр ссылки
              </div>
              <div className="mt-1 break-all font-mono text-sm text-foreground">{slugPreview}</div>
            </div>
          ) : null}
          <Input
            id={slugId}
            value={slugValue}
            onChange={(event) => onSlugChange(event.target.value)}
            placeholder="book-slug"
            disabled={disabled}
            className="h-11 font-mono"
          />
          {slugHelperText ? <p className="text-xs text-muted-foreground">{slugHelperText}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={descriptionId}>Описание</Label>
          <Textarea
            id={descriptionId}
            value={descriptionValue}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Краткое описание книги..."
            disabled={disabled}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label>Режим чтения по умолчанию</Label>
          <Select value={readingMode} onValueChange={onReadingModeChange} disabled={disabled}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="feed">Лента (Feed)</SelectItem>
              <SelectItem value="book">Книга (Book)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showVisibility && typeof isPublic === 'boolean' && onIsPublicChange ? (
          <div className="space-y-2 rounded-xl border px-3 py-3">
            <div className="flex items-center gap-3">
              <Switch checked={isPublic} onCheckedChange={onIsPublicChange} disabled={disabled} />
              <Label className="text-sm">
                {isPublic ? (
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Публичная
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <EyeOff className="h-3.5 w-3.5" />
                    Черновик
                  </span>
                )}
              </Label>
            </div>
            {visibilityNote ? <p className="text-xs text-muted-foreground">{visibilityNote}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
