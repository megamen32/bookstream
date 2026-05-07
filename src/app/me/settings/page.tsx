'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Palette, UserRound } from 'lucide-react'
import UserAreaLayout from '@/components/user/UserAreaLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { accentThemeList } from '@/lib/themes'
import { useReaderStore, type AccentTheme } from '@/lib/store'

export default function UserSettingsPage(): React.ReactElement {
  const {
    readerId,
    username,
    showCommunityAnnotations,
    accentTheme,
    setUsername,
    setShowCommunityAnnotations,
    setAccentTheme,
    loadFromStorage,
  } = useReaderStore()
  const [draftUsername, setDraftUsername] = useState('')
  const [draftVisibility, setDraftVisibility] = useState(true)
  const [draftAccentTheme, setDraftAccentTheme] = useState<AccentTheme>('sky')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (readerId) return
    loadFromStorage()
  }, [readerId, loadFromStorage])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setDraftUsername(username)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [username])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setDraftVisibility(showCommunityAnnotations)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [showCommunityAnnotations])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setDraftAccentTheme(accentTheme)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [accentTheme])

  const handleSave = (): void => {
    const trimmedUsername = draftUsername.trim()
    if (!trimmedUsername) {
      setError('Имя читателя не должно быть пустым.')
      setSaved(false)
      return
    }

    setUsername(trimmedUsername)
    setShowCommunityAnnotations(draftVisibility)
    setAccentTheme(draftAccentTheme)
    setError(null)
    setSaved(true)
  }

  return (
    <UserAreaLayout
      title="Настройки читателя"
      description="Здесь хранятся ваши локальные настройки: отображаемое имя и режим показа чужих аннотаций во время чтения."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound size={18} />
              Профиль
            </CardTitle>
            <CardDescription>
              Это имя будет использоваться для ваших комментариев, реакций и цитат.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="reader-username">Имя читателя</Label>
              <Input
                id="reader-username"
                value={draftUsername}
                onChange={(event) => {
                  setDraftUsername(event.target.value)
                  setSaved(false)
                }}
                placeholder="Например, внимательный читатель"
                maxLength={48}
              />
              <p className="text-sm text-muted-foreground">
                Сейчас: <span className="font-medium text-foreground">{username || 'не задано'}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {draftVisibility ? <Eye size={16} /> : <EyeOff size={16} />}
                    Показывать чужие аннотации
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Когда настройка включена, в ридере видны комментарии, реакции и цитаты других людей.
                    Когда выключена, при чтении останутся только ваши аннотации.
                  </p>
                </div>
                <Switch
                  checked={draftVisibility}
                  onCheckedChange={(checked) => {
                    setDraftVisibility(checked)
                    setSaved(false)
                  }}
                  aria-label="Показывать чужие аннотации"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Palette size={16} />
                  Акцент интерфейса
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Цвет кнопок, выделений, подсветки цитат и основных акцентных элементов.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {accentThemeList.map((themeOption) => {
                  const active = draftAccentTheme === themeOption.name

                  return (
                    <button
                      key={themeOption.name}
                      type="button"
                      onClick={() => {
                        setDraftAccentTheme(themeOption.name)
                        setSaved(false)
                      }}
                      className="rounded-2xl border p-3 text-left transition-all"
                      style={{
                        borderColor: active ? themeOption.vars['--user-accent-border'] : 'var(--border)',
                        backgroundColor: active ? themeOption.vars['--user-accent-soft'] : 'var(--card)',
                        boxShadow: active ? `0 12px 28px -24px ${themeOption.vars['--user-accent']}` : 'none',
                      }}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span
                          className="inline-flex h-6 w-6 rounded-full border"
                          style={{
                            backgroundColor: themeOption.vars['--user-accent'],
                            borderColor: themeOption.vars['--user-accent-border'],
                          }}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {themeOption.label}
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {themeOption.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {!error && saved && (
              <p className="text-sm" style={{ color: 'var(--user-accent-text)' }}>Настройки сохранены.</p>
            )}

            <Button onClick={handleSave} className="w-full sm:w-auto">
              Сохранить настройки
            </Button>
          </CardContent>
        </Card>

        <Card
          className="border-border/70"
          style={{
            background: 'linear-gradient(135deg, var(--user-accent-soft) 0%, var(--background) 55%, color-mix(in srgb, var(--user-accent) 10%, white) 100%)',
          }}
        >
          <CardHeader>
            <CardTitle>Текущий профиль</CardTitle>
            <CardDescription>
              Настройки привязаны к вашему локальному `readerId`.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <div className="text-muted-foreground">Имя</div>
              <div className="mt-1 font-medium text-foreground">{username || 'не задано'}</div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <div className="text-muted-foreground">Чужие аннотации</div>
              <div className="mt-1 font-medium text-foreground">
                {showCommunityAnnotations ? 'Показываются' : 'Скрыты во время чтения'}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <div className="text-muted-foreground">Акцент</div>
              <div className="mt-1 font-medium text-foreground">
                {accentThemeList.find((themeOption) => themeOption.name === accentTheme)?.label || 'Голубой свет'}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <div className="text-muted-foreground">readerId</div>
              <div className="mt-1 break-all font-mono text-xs text-foreground">
                {readerId || 'загружается…'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </UserAreaLayout>
  )
}
