'use client'

import { useReaderStore } from '@/lib/store'
import type { VariantType } from '@/lib/store'

interface VariantSliderProps {
  onVariantChange: (type: VariantType) => void
  availableVariants: Array<VariantType>
}

const VARIANT_INFO: Record<VariantType, { label: string; emoji: string }> = {
  original: { label: 'Оригинал', emoji: '📝' },
  clean: { label: 'Без воды', emoji: '✂️' },
  essence: { label: 'Суть', emoji: '💡' },
}

export default function VariantSlider({ onVariantChange, availableVariants }: VariantSliderProps) {
  const { variantType, setVariantType } = useReaderStore()

  const handleChange = (type: VariantType) => {
    setVariantType(type)
    onVariantChange(type)
  }

  if (availableVariants.length <= 1) return null

  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: 'var(--r-bg-secondary)',
        borderRadius: '0.5rem',
        padding: '0.1875rem',
        gap: '0.125rem',
      }}
    >
      {availableVariants.map((type) => {
        const isActive = variantType === type
        const info = VARIANT_INFO[type]
        return (
          <button
            key={type}
            onClick={() => handleChange(type)}
            style={{
              flex: 1,
              padding: '0.4375rem 0.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: isActive ? 600 : 400,
              backgroundColor: isActive ? 'var(--r-accent)' : 'transparent',
              color: isActive ? 'var(--r-accent-foreground)' : 'var(--r-text-secondary)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              minHeight: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
            }}
          >
            <span>{info.emoji}</span>
            <span>{info.label}</span>
          </button>
        )
      })}
    </div>
  )
}
