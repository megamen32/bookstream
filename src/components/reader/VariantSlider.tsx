'use client'

import { useReaderStore } from '@/lib/store'
import type { VariantType } from '@/lib/store'

interface VariantPresetMeta {
  id?: string
  label: string
  emoji: string
  description?: string
  targetSizePercent?: number | null
  position?: number
}

interface VariantSliderProps {
  onVariantChange: (type: VariantType) => void
  /** Variant types that already exist in DB (have content) */
  generatedVariants: string[]
  /** Preset metadata from API, keyed by slug */
  variantPresets?: Record<string, VariantPresetMeta>
  /** Currently generating variant type (shows spinner) */
  generatingVariant?: string | null
}

const BUILTIN_INFO: Record<string, { label: string; emoji: string }> = {
  original: { label: 'Оригинал', emoji: '📝' },
}

export default function VariantSlider({
  onVariantChange,
  generatedVariants,
  variantPresets = {},
  generatingVariant = null,
}: VariantSliderProps) {
  const { variantType, setVariantType } = useReaderStore()

  const generatedSet = new Set(generatedVariants)

  // Build items: original + all presets
  const allItems: Array<{ type: string; preset?: VariantPresetMeta; isGenerated: boolean }> = [
    { type: 'original', isGenerated: generatedSet.has('original') },
    ...Object.entries(variantPresets).map(([slug, preset]) => ({
      type: slug,
      preset,
      isGenerated: generatedSet.has(slug),
    })),
  ]

  // Sort: original first, then by preset position
  const sortedItems = [...allItems].sort((a, b) => {
    if (a.type === 'original') return -1
    if (b.type === 'original') return 1
    const posA = a.preset?.position ?? 999
    const posB = b.preset?.position ?? 999
    return posA - posB
  })

  // Don't show slider if only original exists and no presets
  if (sortedItems.length <= 1) return null

  const handleChange = (type: string) => {
    setVariantType(type)
    onVariantChange(type)
  }

  return (
    <div
      className="reader-variant-slider"
      style={{
        display: 'flex',
        backgroundColor: 'color-mix(in srgb, var(--r-bg-secondary) 72%, transparent)',
        borderRadius: '9999px',
        padding: '0.25rem',
        gap: '0.1875rem',
        border: '1px solid color-mix(in srgb, var(--r-border) 68%, transparent)',
        backdropFilter: 'blur(14px)',
        overflowX: 'auto',
      }}
    >
      {sortedItems.map(({ type, preset, isGenerated }) => {
        const isActive = variantType === type
        const isGenerating = generatingVariant === type
        const label = preset?.label || BUILTIN_INFO[type]?.label || type
        const emoji = preset?.emoji || BUILTIN_INFO[type]?.emoji || ''

        return (
          <button
            key={type}
            onClick={() => !isGenerating && handleChange(type)}
            disabled={isGenerating}
            style={{
              flex: 1,
              padding: '0.55rem 0.8rem',
              borderRadius: '9999px',
              border: isActive
                ? 'none'
                : isGenerated
                  ? '1px solid transparent'
                  : '1px dashed color-mix(in srgb, var(--r-border) 78%, transparent)',
              cursor: isGenerating ? 'wait' : 'pointer',
              fontSize: '0.75rem',
              fontWeight: isActive ? 600 : 400,
              backgroundColor: isActive
                ? 'var(--r-accent)'
                : 'color-mix(in srgb, transparent 72%, var(--r-bg) 28%)',
              color: isActive
                ? 'var(--r-accent-foreground)'
                : isGenerated
                  ? 'var(--r-text-secondary)'
                  : 'var(--r-text-tertiary, var(--r-text-secondary))',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              minHeight: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
              opacity: isGenerating ? 0.7 : 1,
              position: 'relative',
              boxShadow: isActive ? '0 12px 26px color-mix(in srgb, var(--r-accent) 22%, transparent)' : 'none',
            }}
            title={
              isGenerating
                ? 'Генерация...'
                : !isGenerated
                  ? `Сгенерировать "${label}" с помощью AI`
                  : preset?.description || undefined
            }
          >
            {isGenerating ? (
              <span
                style={{
                  display: 'inline-flex',
                  width: '0.875rem',
                  height: '0.875rem',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{
                    width: '100%',
                    height: '100%',
                    animation: 'spin 1s linear infinite',
                    color: isActive ? 'var(--r-accent-foreground)' : 'var(--r-accent)',
                  }}
                >
                  <circle
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="31.4 31.4"
                  />
                </svg>
              </span>
            ) : (
              <>
                {emoji && <span>{emoji}</span>}
                {!isGenerated && (
                  <span
                    style={{
                      fontSize: '0.625rem',
                      opacity: 0.6,
                      marginLeft: '-0.125rem',
                    }}
                  >
                    ✨
                  </span>
                )}
              </>
            )}
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
