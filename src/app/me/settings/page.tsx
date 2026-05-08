'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, KeyRound, Palette, Sparkles, UserRound } from 'lucide-react'
import UserAreaLayout from '@/components/user/UserAreaLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { accentThemeList } from '@/lib/themes'
import { useReaderStore, type AccentTheme } from '@/lib/store'

interface ReaderMetaResponse {
  hasPassword?: boolean
  llmBaseUrl?: string | null
  llmModel?: string | null
  hasCustomLlmConfig?: boolean
  hasEffectiveLlmConfig?: boolean
  llmConfigSource?: 'custom' | 'main-admin-default' | 'none'
}

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
  const [draftPassword, setDraftPassword] = useState('')
  const [draftPasswordConfirm, setDraftPasswordConfirm] = useState('')
  const [draftLlmApiKey, setDraftLlmApiKey] = useState('')
  const [draftLlmBaseUrl, setDraftLlmBaseUrl] = useState('')
  const [draftLlmModel, setDraftLlmModel] = useState('')
  const [hasAdminPassword, setHasAdminPassword] = useState(false)
  const [hasEffectiveLlmConfig, setHasEffectiveLlmConfig] = useState(false)
  const [llmConfigSource, setLlmConfigSource] = useState<'custom' | 'main-admin-default' | 'none'>('none')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    if (!readerId) return

    let active = true

    async function loadReaderMeta(): Promise<void> {
      try {
        const response = await fetch(`/api/readers?id=${encodeURIComponent(readerId)}`)
        if (!response.ok) {
          return
        }

        const data = await response.json() as ReaderMetaResponse | null
        if (active) {
          setHasAdminPassword(Boolean(data?.hasPassword))
          setHasEffectiveLlmConfig(Boolean(data?.hasEffectiveLlmConfig))
          setLlmConfigSource(data?.llmConfigSource || 'none')
        }
      } catch {
        // Reader meta is informative only.
      }
    }

    void loadReaderMeta()

    return () => {
      active = false
    }
  }, [readerId])

  const handleSave = async (): Promise<void> => {
    const trimmedUsername = draftUsername.trim()
    if (!trimmedUsername) {
      setError('Имя читателя не должно быть пустым.')
      setSaved(false)
      return
    }

    if (!readerId) {
      setError('readerId ещё не готов, попробуйте через секунду.')
      setSaved(false)
      return
    }

    if (draftPassword && draftPassword.length < 4) {
      setError('Пароль для админки должен быть не короче 4 символов.')
      setSaved(false)
      return
    }

    if (draftPassword !== draftPasswordConfirm) {
      setError('Подтверждение пароля не совпадает.')
      setSaved(false)
      return
    }

    const llmFieldsProvided = Boolean(
      draftLlmApiKey.trim() || draftLlmBaseUrl.trim() || draftLlmModel.trim()
    )
    if (
      llmFieldsProvided &&
      (!draftLlmApiKey.trim() || !draftLlmBaseUrl.trim() || !draftLlmModel.trim())
    ) {
      setError('Для LLM нужно заполнить сразу api key, base url и model.')
      setSaved(false)
      return
    }

    setSaving(true)

    try {
      const syncResponse = await fetch('/api/readers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: readerId,
          currentUsername: trimmedUsername,
        }),
      })

      if (!syncResponse.ok) {
        const payload = await syncResponse.json() as { error?: string }
        throw new Error(payload.error || 'Не удалось сохранить имя читателя')
      }

      if (draftPassword) {
        const passwordResponse = await fetch('/api/readers/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readerId,
            currentUsername: trimmedUsername,
            password: draftPassword,
          }),
        })

        if (!passwordResponse.ok) {
          const payload = await passwordResponse.json() as { error?: string }
          throw new Error(payload.error || 'Не удалось сохранить пароль')
        }

        setHasAdminPassword(true)
        setDraftPassword('')
        setDraftPasswordConfirm('')
      }

      if (llmFieldsProvided || (hasEffectiveLlmConfig && !draftLlmApiKey.trim() && !draftLlmBaseUrl.trim() && !draftLlmModel.trim())) {
        const llmResponse = await fetch('/api/readers/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readerId,
            apiKey: draftLlmApiKey,
            baseUrl: draftLlmBaseUrl,
            model: draftLlmModel,
          }),
        })

        const payload = await llmResponse.json() as {
          error?: string
          hasEffectiveLlmConfig?: boolean
          llmConfigSource?: 'custom' | 'main-admin-default' | 'none'
        }
        if (!llmResponse.ok) {
          throw new Error(payload.error || 'Не удалось сохранить LLM настройки')
        }
        setHasEffectiveLlmConfig(Boolean(payload.hasEffectiveLlmConfig))
        setLlmConfigSource(payload.llmConfigSource || 'none')
        setDraftLlmApiKey('')
      }

      setUsername(trimmedUsername)
      setShowCommunityAnnotations(draftVisibility)
      setAccentTheme(draftAccentTheme)
      setError(null)
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить настройки.')
      setSaved(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <UserAreaLayout
      title="Настройки читателя"
      description="Здесь хранятся ваше имя читателя, локальные настройки чтения и пароль для простой админки."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound size={18} />
              Профиль
            </CardTitle>
            <CardDescription>
              Это имя будет использоваться для ваших комментариев, реакций, цитат и входа в админку.
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
              <p className="text-xs text-muted-foreground">
                Логин в админку всегда совпадает с этим именем.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles size={16} />
                  LLM для генерации вариантов
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Эти данные используются, если вам нужно генерировать варианты книги за свой счёт.
                </p>
                <p className="text-xs text-muted-foreground">
                  Статус: {hasEffectiveLlmConfig ? `настроено (${llmConfigSource})` : 'не настроено'}
                </p>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="llm-api-key">API key</Label>
                  <Input
                    id="llm-api-key"
                    type="password"
                    value={draftLlmApiKey}
                    onChange={(event) => {
                      setDraftLlmApiKey(event.target.value)
                      setSaved(false)
                    }}
                    placeholder="sk-..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="llm-base-url">Base URL</Label>
                  <Input
                    id="llm-base-url"
                    value={draftLlmBaseUrl}
                    onChange={(event) => {
                      setDraftLlmBaseUrl(event.target.value)
                      setSaved(false)
                    }}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="llm-model">Model</Label>
                  <Input
                    id="llm-model"
                    value={draftLlmModel}
                    onChange={(event) => {
                      setDraftLlmModel(event.target.value)
                      setSaved(false)
                    }}
                    placeholder="gpt-4.1-mini"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <KeyRound size={16} />
                  Пароль для админки
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Любой читатель может задать себе пароль и получить свою простую админку для загрузки книг.
                </p>
                <p className="text-xs text-muted-foreground">
                  Статус: {hasAdminPassword ? 'пароль уже задан' : 'пароль ещё не задан'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-password">
                    {hasAdminPassword ? 'Новый пароль' : 'Пароль'}
                  </Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={draftPassword}
                    onChange={(event) => {
                      setDraftPassword(event.target.value)
                      setSaved(false)
                    }}
                    placeholder="Минимум 4 символа"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-password-confirm">Подтверждение</Label>
                  <Input
                    id="admin-password-confirm"
                    type="password"
                    value={draftPasswordConfirm}
                    onChange={(event) => {
                      setDraftPasswordConfirm(event.target.value)
                      setSaved(false)
                    }}
                    placeholder="Повторите пароль"
                  />
                </div>
              </div>
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

            <Button onClick={() => void handleSave()} className="w-full sm:w-auto" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить настройки'}
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
              <div className="text-muted-foreground">Админка</div>
              <div className="mt-1 space-y-3">
                <div className="font-medium text-foreground">
                  {hasAdminPassword ? 'Доступна по имени читателя и паролю' : 'Пароль пока не задан'}
                </div>
                <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                  <Link href="/admin" aria-label="Перейти в админку">
                    Перейти в админку
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <div className="text-muted-foreground">LLM</div>
              <div className="mt-1 font-medium text-foreground">
                {hasEffectiveLlmConfig ? `Готово (${llmConfigSource})` : 'Не настроено'}
              </div>
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
