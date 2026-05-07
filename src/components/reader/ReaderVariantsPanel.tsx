'use client'

import type React from 'react'
import { StretchHorizontal } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import VariantSlider from './VariantSlider'
import type { VariantType } from '@/lib/store'

interface VariantPresetMeta {
  id?: string
  label: string
  emoji: string
  description?: string
  targetSizePercent?: number | null
  position?: number
}

interface ReaderVariantsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVariantChange: (type: VariantType) => void
  generatedVariants: string[]
  variantPresets: Record<string, VariantPresetMeta>
  generatingVariant?: string | null
}

export default function ReaderVariantsPanel({
  open,
  onOpenChange,
  onVariantChange,
  generatedVariants,
  variantPresets,
  generatingVariant = null,
}: ReaderVariantsPanelProps): React.ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="reader-sheet reader-sheet--bottom"
        style={{
          maxHeight: '72vh',
          backgroundColor: 'var(--r-bg)',
          color: 'var(--r-text)',
          borderTop: '1px solid color-mix(in srgb, var(--r-border) 82%, transparent)',
        }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: 'var(--r-text)' }}>
            <StretchHorizontal size={18} className="inline-block mr-2" />
            Версии текста
          </SheetTitle>
          <SheetDescription style={{ color: 'var(--r-text-secondary)' }}>
            Переключайтесь между оригиналом и более компактными вариантами главы
          </SheetDescription>
        </SheetHeader>

        <div className="reader-variants-panel">
          <VariantSlider
            onVariantChange={onVariantChange}
            generatedVariants={generatedVariants}
            variantPresets={variantPresets}
            generatingVariant={generatingVariant}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
