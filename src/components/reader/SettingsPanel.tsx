'use client'

import Link from 'next/link'
import { useReaderStore } from '@/lib/store'
import { accentThemeList, themeList } from '@/lib/themes'
import type { ReaderTheme, LineWidth } from '@/lib/store'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Settings, Sun, Moon, BookOpen, Monitor, Sparkles, UserRound } from 'lucide-react'

interface SettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const WIDTH_LABELS: Record<LineWidth, string> = {
  narrow: 'Узкий',
  medium: 'Средний',
  wide: 'Широкий',
}

const THEME_ICONS: Record<ReaderTheme, React.ReactNode> = {
  light: <Sun size={14} />,
  sepia: <BookOpen size={14} />,
  dark: <Moon size={14} />,
  oled: <Monitor size={14} />,
}

export default function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const {
    fontSize,
    lineHeight,
    lineWidth,
    theme,
    accentTheme,
    username,
    showCommunityAnnotations,
    showMobileReactionBar,
    setFontSize,
    setLineHeight,
    setLineWidth,
    setTheme,
    setShowMobileReactionBar,
  } = useReaderStore()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl"
        style={{
          maxHeight: '80vh',
          backgroundColor: 'var(--r-bg)',
          color: 'var(--r-text)',
          borderTop: '1px solid var(--r-border)',
        }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: 'var(--r-text)' }}>
            <Settings size={18} className="inline-block mr-2" />
            Настройки чтения
          </SheetTitle>
        </SheetHeader>

        <div style={{ padding: '0 1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Font Size */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Размер шрифта</label>
              <span style={{ fontSize: '0.8125rem', color: 'var(--r-text-secondary)' }}>{fontSize}px</span>
            </div>
            <Slider
              value={[fontSize]}
              onValueChange={([v]) => setFontSize(v)}
              min={16}
              max={32}
              step={1}
              style={{ accentColor: 'var(--r-accent)' }}
            />
          </div>

          {/* Line Height */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Высота строки</label>
              <span style={{ fontSize: '0.8125rem', color: 'var(--r-text-secondary)' }}>{lineHeight.toFixed(1)}</span>
            </div>
            <Slider
              value={[lineHeight]}
              onValueChange={([v]) => setLineHeight(v)}
              min={1.4}
              max={2.2}
              step={0.1}
              style={{ accentColor: 'var(--r-accent)' }}
            />
          </div>

          {/* Line Width */}
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>
              Ширина строки
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(Object.keys(WIDTH_LABELS) as LineWidth[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setLineWidth(w)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${lineWidth === w ? 'var(--r-accent)' : 'var(--r-border)'}`,
                    backgroundColor: lineWidth === w ? 'var(--r-accent)' : 'transparent',
                    color: lineWidth === w ? 'var(--r-accent-foreground)' : 'var(--r-text)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    minHeight: '44px',
                    fontWeight: lineWidth === w ? 600 : 400,
                  }}
                >
                  {WIDTH_LABELS[w]}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>
              Тема оформления
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {themeList.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setTheme(t.name as ReaderTheme)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.625rem 0.25rem',
                    borderRadius: '0.5rem',
                    border: `2px solid ${theme === t.name ? 'var(--r-accent)' : 'var(--r-border)'}`,
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    minHeight: '60px',
                    color: 'var(--r-text)',
                    fontSize: '0.6875rem',
                  }}
                >
                  <div
                    style={{
                      width: '1.5rem',
                      height: '1.5rem',
                      borderRadius: '50%',
                      backgroundColor: t.vars['--r-bg'],
                      border: `2px solid ${t.vars['--r-border']}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {THEME_ICONS[t.name as ReaderTheme]}
                  </div>
                  <span style={{ fontWeight: theme === t.name ? 600 : 400 }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.875rem 1rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--r-border)',
              backgroundColor: 'var(--r-bg-secondary)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                Панель реакций на мобильном
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--r-text-secondary)', marginTop: '0.125rem' }}>
                Показывать кнопки реакций под абзацами
              </div>
            </div>
            <Switch checked={showMobileReactionBar} onCheckedChange={setShowMobileReactionBar} />
          </div>

          {/* Very large quick button */}
          <button
            onClick={() => {
              setFontSize(24)
              setLineHeight(2.0)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--r-border)',
              backgroundColor: 'var(--r-bg-secondary)',
              color: 'var(--r-text)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              minHeight: '48px',
            }}
          >
            <Sparkles size={16} />
            Очень крупный шрифт
          </button>

          <Link
            href="/me/settings"
            onClick={() => onOpenChange(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.875rem 1rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--r-border)',
              backgroundColor: 'var(--r-bg-secondary)',
              color: 'var(--r-text)',
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <UserRound size={18} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  Профиль и видимость аннотаций
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--r-text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {username} · {accentThemeList.find((item) => item.name === accentTheme)?.label || 'Голубой свет'}
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--r-text-secondary)', flexShrink: 0 }}>
              Открыть
            </span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
