'use client'

import type { ReactNode } from 'react'
import { ImagePlus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface BookCoverSectionProps {
  title?: string
  description?: string
  previewUrl?: string | null
  emptyTitle?: string
  emptyDescription?: string
  helperText?: string
  actions?: ReactNode
  tools?: ReactNode
  previewClassName?: string
  previewFit?: 'contain' | 'cover'
}

/**
 * Shows the reusable admin section for cover preview and related actions.
 *
 * @param props Section configuration and optional actions/tools.
 * @returns Cover preview card.
 */
export function BookCoverSection({
  title = 'Обложка',
  description,
  previewUrl,
  emptyTitle = 'Обложка пока не выбрана',
  emptyDescription = 'После загрузки файла здесь появится найденная картинка, если она есть',
  helperText,
  actions,
  tools,
  previewClassName,
  previewFit = 'contain',
}: BookCoverSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {previewUrl ? (
          <div className="overflow-hidden rounded-xl border bg-muted p-4">
            <div className="mx-auto max-w-sm overflow-hidden rounded-[1.5rem] border bg-background shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <img
                src={previewUrl}
                alt="Предпросмотр обложки"
                className={cn(
                  'aspect-[3/4] w-full bg-muted',
                  previewFit === 'cover' ? 'object-cover' : 'object-contain',
                  previewClassName
                )}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-xl border border-dashed bg-muted/30 text-center">
            <div className="space-y-2 px-6">
              <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{emptyTitle}</p>
              <p className="text-xs text-muted-foreground">{emptyDescription}</p>
            </div>
          </div>
        )}

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
        {tools}
      </CardContent>
    </Card>
  )
}
