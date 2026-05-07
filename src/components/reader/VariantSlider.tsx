'use client'

import { useReaderStore } from '@/lib/store'
import type { VariantType } from '@/lib/store'

interface VariantPresetMeta {
  label: string
  emoji: string
  description?: string
  targetSizePercent?: number | null
  /** Display order from DB (lower = first) */
  position?: number
}

interface VariantSliderProps {
  onVariantChange: (type: VariantType) => void
  availableVariants: Array<VariantType>
  /** Preset metadata from API, keyed by slug */
  variantPresets?: Record<string, VariantPresetMeta>
}

/** Built-in fallback labels for the 3 standard variants */
const BUILTIN_INFO: Record<string, { label: string; emoji: string }> = {
  original: { label: 'Оригинал', emoji: '📝' },
  clean: { label: 'Без воды', emoji: '✂️' },
  essence: { label: 'Суть', emoji: '💡' },
}

export default function VariantSlider({
  onVariantChange,
  availableVariants,
  variantPresets = {},
}: VariantSliderProps) {
  const { variantType, setVariantType } = useReaderStore()

  const handleChange = (type: VariantType) => {
    setVariantType(type)
    onVariantChange(type)
  }

  // Build sorted list: original first, then by preset position, then by targetSizePercent desc
  const sortedVariants = [...availableVariants].sort((a, b) => {
    // original always first
    if (a === 'original') return -1
    if (b === 'original') return 1
    // use DB position if available (lower position = first)
    const posA = variantPresets[a]?.position ?? 999
    const posB = variantPresets[b]?.position ?? 999
    if (posA !== posB) return posA - posB
    // fallback: higher targetSizePercent first (100% before 50% before 20%)
    const sizeA = variantPresets[a]?.targetSizePercent ?? 999
    const sizeB = variantPresets[b]?.targetSizePercent ?? 999
    return sizeB - sizeA
  })

  if (sortedVariants.length <= 1) return null

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
      {sortedVariants.map((type) => {
        const isActive = variantType === type
        const preset = variantPresets[type]
        const label = preset?.label || BUILTIN_INFO[type]?.label || type
        const emoji = preset?.emoji || BUILTIN_INFO[type]?.emoji || ''

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
            title={preset?.description || undefined}
          >
            {emoji && <span>{emoji}</span>}
            <span>{label}</span>
            {preset?.targetSizePercent != null && (
              <span
                style={{
                  fontSize: '0.625rem',
                  opacity: 0.7,
                }}
              >
                {preset.targetSizePercent}%
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
