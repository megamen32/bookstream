'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import AdminLinkDeviceCard from '@/components/admin/AdminLinkDeviceCard'
import { Save, Loader2, ShieldCheck, Sparkles, User, KeyRound } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { fetchAdmin } from '@/lib/admin-fetch'
import { slugify } from '@/lib/slugify'

interface Author {
  id: string
  name: string
  slug: string
  bio: string | null
}

interface ByokPreset {
  id: string
  label: string
  description: string
  apiFormat: 'anthropic' | 'chat-completions' | 'responses'
  baseUrl: string
  modelId: string
  contextWindow: number | null
  maxOutputTokens: number | null
  inputPricePerMillionUsd: number | null
  cacheReadPricePerMillionUsd: number | null
  cacheWritePricePerMillionUsd: number | null
  outputPricePerMillionUsd: number | null
  note?: string
}

interface AdminSettingsPayload {
  settings: {
    allowUserPublishing: boolean
  }
  reader: {
    id: string
    isMainAdmin: boolean
  }
}

export default function AdminProfilePage() {
  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit fields
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [bio, setBio] = useState('')
  const [nameChanged, setNameChanged] = useState(false)
  const [isMainAdmin, setIsMainAdmin] = useState(false)
  const [allowUserPublishing, setAllowUserPublishing] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [readerId, setReaderId] = useState('')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [llmApiFormat, setLlmApiFormat] = useState<'anthropic' | 'chat-completions' | 'responses'>('chat-completions')
  const [byokPresets, setByokPresets] = useState<ByokPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState('custom')
  const [hasPassword, setHasPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [hasEffectiveLlmConfig, setHasEffectiveLlmConfig] = useState(false)
  const [llmConfigSource, setLlmConfigSource] = useState<'custom' | 'main-admin-default' | 'none'>('none')
  const [savingLlm, setSavingLlm] = useState(false)

  const { toast } = useToast()
  const router = useRouter()
  const adminFetch = useCallback(
    (input: RequestInfo | URL, options: RequestInit = {}) => fetchAdmin(input, router, options),
    [router],
  )

  useEffect(() => {
    adminFetch('/api/authors')
      .then((res) => {
        if (!res) {
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data) {
          // API returns array of authors; use the first one
          const authorData = Array.isArray(data) ? data[0] : data
          if (authorData) {
            setAuthor(authorData)
            setName(authorData.name)
            setSlug(authorData.slug)
            setBio(authorData.bio || '')
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [adminFetch])

  useEffect(() => {
    adminFetch('/api/admin/settings')
      .then(async (res) => {
        if (!res) {
          return null
        }
        if (!res.ok) {
          return null
        }
        return await res.json() as AdminSettingsPayload
      })
      .then((payload) => {
        if (!payload) {
          return
        }

        setReaderId(payload.reader.id)
        setIsMainAdmin(payload.reader.isMainAdmin)
        setAllowUserPublishing(payload.settings.allowUserPublishing)
      })
      .catch(console.error)
  }, [adminFetch])

  useEffect(() => {
    if (!readerId) {
      return
    }

    adminFetch(`/api/readers?id=${encodeURIComponent(readerId)}`)
      .then(async (res) => {
        if (!res) {
          return null
        }
        if (!res.ok) {
          return null
        }
        return await res.json() as {
          currentUsername?: string
          hasPassword?: boolean
          llmBaseUrl?: string | null
          llmModel?: string | null
          llmApiFormat?: 'anthropic' | 'chat-completions' | 'responses' | null
          hasEffectiveLlmConfig?: boolean
          llmConfigSource?: 'custom' | 'main-admin-default' | 'none'
        } | null
      })
      .then((payload) => {
        if (!payload) {
          return
        }

        if (payload.currentUsername) setName(payload.currentUsername)
        setHasPassword(Boolean(payload.hasPassword))
        setLlmBaseUrl(payload.llmBaseUrl || '')
        setLlmModel(payload.llmModel || '')
        setLlmApiFormat(payload.llmApiFormat || 'chat-completions')
        setHasEffectiveLlmConfig(Boolean(payload.hasEffectiveLlmConfig))
        setLlmConfigSource(payload.llmConfigSource || 'none')
      })
      .catch(console.error)
  }, [adminFetch, readerId])

  useEffect(() => {
    fetch('/api/model-catalog')
      .then((response) => response.json())
      .then((payload: { presets?: ByokPreset[] }) => {
        const presets = Array.isArray(payload.presets) ? payload.presets : []
        setByokPresets(presets)
        const matched = presets.find((preset) => preset.baseUrl === llmBaseUrl && preset.modelId === llmModel)
        if (matched) setSelectedPresetId(matched.id)
      })
      .catch(console.error)
  }, [llmBaseUrl, llmModel])

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = byokPresets.find((item) => item.id === presetId)
    if (!preset) return
    setLlmApiFormat(preset.apiFormat)
    setLlmBaseUrl(preset.baseUrl)
    setLlmModel(preset.modelId)
  }

  const handleNameChange = (value: string) => {
    setName(value)
    setNameChanged(true)
    if (!slug || slug === slugify(author?.name || '') || slug === slugify(name)) {
      setSlug(slugify(value))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !slug) return

    setSaving(true)
    try {
      if (readerId) {
        const readerResponse = await adminFetch('/api/readers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: readerId, currentUsername: name.trim() }),
        })
        if (!readerResponse?.ok) {
          const payload = readerResponse ? await readerResponse.json() as { error?: string } : null
          throw new Error(payload?.error || 'Не удалось сохранить имя профиля')
        }
        try {
          const raw = localStorage.getItem('bookstream-reader-state')
          const state = raw ? JSON.parse(raw) as Record<string, unknown> : {}
          localStorage.setItem('bookstream-reader-state', JSON.stringify({ ...state, readerId, username: name.trim() }))
        } catch {}
      }
      const method = author ? 'PUT' : 'POST'
      const res = await adminFetch('/api/authors', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, bio }),
      })

      if (!res) {
        return
      }

      if (res.ok) {
        const data = await res.json()
        setAuthor(data)
        setNameChanged(false)
        toast({ title: 'Профиль сохранён' })
      } else {
        const data = await res.json()
        toast({
          title: 'Ошибка',
          description: data.error || 'Не удалось сохранить',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({ title: 'Ошибка сохранения', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handlePublishingToggle = async (checked: boolean): Promise<void> => {
    if (!isMainAdmin) {
      return
    }

    setSavingSettings(true)

    try {
      const response = await adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowUserPublishing: checked,
        }),
      })

      if (!response) {
        return
      }

      const payload = await response.json() as { error?: string; settings?: { allowUserPublishing: boolean } }
      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || 'Не удалось обновить правила публикации')
      }

      setAllowUserPublishing(payload.settings.allowUserPublishing)
      toast({
        title: 'Правила публикации обновлены',
        description: payload.settings.allowUserPublishing
          ? 'Обычные пользователи снова могут публиковать книги.'
          : 'Обычные пользователи теперь могут загружать книги только как приватные черновики.',
      })
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось обновить правила публикации',
        variant: 'destructive',
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveLlm = async (): Promise<void> => {
    if (!readerId) {
      return
    }

    const llmFieldsProvided = Boolean(llmApiKey.trim() || llmBaseUrl.trim() || llmModel.trim())
    if (llmFieldsProvided && (!llmApiKey.trim() || !llmBaseUrl.trim() || !llmModel.trim())) {
      toast({
        title: 'Ошибка',
        description: 'Для LLM нужно заполнить сразу api key, base url и model.',
        variant: 'destructive',
      })
      return
    }

    setSavingLlm(true)

    try {
      const response = await adminFetch('/api/readers/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerId,
          apiKey: llmApiKey,
          baseUrl: llmBaseUrl,
          model: llmModel,
          apiFormat: llmApiFormat,
        }),
      })

      if (!response) {
        return
      }

      const payload = await response.json() as {
        error?: string
        hasEffectiveLlmConfig?: boolean
        llmConfigSource?: 'custom' | 'main-admin-default' | 'none'
      }
      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось сохранить LLM настройки')
      }

      setHasEffectiveLlmConfig(Boolean(payload.hasEffectiveLlmConfig))
      setLlmConfigSource(payload.llmConfigSource || 'none')
      setLlmApiKey('')
      toast({ title: 'LLM настройки сохранены' })
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось сохранить LLM настройки',
        variant: 'destructive',
      })
    } finally {
      setSavingLlm(false)
    }
  }

  const handleSavePassword = async () => {
    if (!readerId || !name.trim()) return
    if (newPassword.length < 4) {
      toast({ title: 'Пароль слишком короткий', description: 'Минимум 4 символа.', variant: 'destructive' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Пароли не совпадают', variant: 'destructive' })
      return
    }
    setSavingPassword(true)
    try {
      const response = await adminFetch('/api/readers/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readerId, currentUsername: name.trim(), password: newPassword }),
      })
      const payload = response ? await response.json() as { error?: string } : null
      if (!response?.ok) throw new Error(payload?.error || 'Не удалось сохранить пароль')
      setHasPassword(true)
      setNewPassword('')
      setConfirmPassword('')
      toast({ title: hasPassword ? 'Пароль изменён' : 'Пароль установлен' })
    } catch (error) {
      toast({ title: 'Ошибка', description: error instanceof Error ? error.message : 'Не удалось сохранить пароль', variant: 'destructive' })
    } finally {
      setSavingPassword(false)
    }
  }

  const selectedPreset = byokPresets.find((preset) => preset.id === selectedPresetId)
  const sampleInputTokens = 10_000
  const sampleOutputTokens = 2_000
  const sampleCostUsd = selectedPreset?.inputPricePerMillionUsd != null && selectedPreset.outputPricePerMillionUsd != null
    ? sampleInputTokens / 1_000_000 * selectedPreset.inputPricePerMillionUsd + sampleOutputTokens / 1_000_000 * selectedPreset.outputPricePerMillionUsd
    : null

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Профиль</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Одна учётная запись для чтения, публикации и админки
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Avatar area */}
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{name || 'Без имени'}</h3>
              <p className="text-sm text-muted-foreground">@{slug || 'author'}</p>
            </div>
          </CardContent>
        </Card>

        {isMainAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Главный админ
              </CardTitle>
              <CardDescription>
                Здесь задаётся, могут ли обычные пользователи публиковать книги, или только хранить их приватно у себя.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Разрешить публикацию пользователям</div>
                  <p className="text-xs text-muted-foreground">
                    Если выключить, новые и отредактированные пользовательские книги будут оставаться приватными и видимыми только их владельцам.
                  </p>
                </div>
                <Switch
                  checked={allowUserPublishing}
                  onCheckedChange={(checked) => {
                    void handlePublishingToggle(checked)
                  }}
                  disabled={savingSettings}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Текущее состояние: {allowUserPublishing ? 'публикация разрешена' : 'публикация выключена для обычных пользователей'}.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />Пароль</CardTitle>
            <CardDescription>{hasPassword ? 'Пароль установлен. Здесь его можно сменить.' : 'Пароль необязателен, но пригодится для входа с нового устройства.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={hasPassword ? 'Новый пароль' : 'Установить пароль'} />
            <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Повторите пароль" />
            <Button type="button" variant="outline" onClick={() => void handleSavePassword()} disabled={savingPassword || !newPassword || !confirmPassword}>
              {savingPassword ? 'Сохранение...' : hasPassword ? 'Сменить пароль' : 'Установить пароль'}
            </Button>
          </CardContent>
        </Card>

        <AdminLinkDeviceCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              LLM
            </CardTitle>
            <CardDescription>
              Эти данные используются для генерации вариантов ваших книг. У главного админа при пустых полях остаются системные env-настройки, у остальных дефолтов нет.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Статус: {hasEffectiveLlmConfig ? `настроено (${llmConfigSource})` : 'не настроено'}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-llm-preset">Провайдер / пресет</Label>
              <select id="profile-llm-preset" value={selectedPresetId} onChange={(event) => applyPreset(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {byokPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}: {preset.description}</option>)}
              </select>
              {selectedPreset?.note ? <p className="text-xs text-amber-700">{selectedPreset.note}</p> : null}
            </div>
            {selectedPreset ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border p-3"><div className="text-[11px] uppercase text-muted-foreground">Контекст</div><div className="font-semibold">{selectedPreset.contextWindow?.toLocaleString('ru-RU') || '—'}</div></div>
                <div className="rounded-lg border p-3"><div className="text-[11px] uppercase text-muted-foreground">Цена / 1M</div><div className="font-semibold">{selectedPreset.inputPricePerMillionUsd != null ? `$${selectedPreset.inputPricePerMillionUsd} in` : '—'} / {selectedPreset.outputPricePerMillionUsd != null ? `$${selectedPreset.outputPricePerMillionUsd} out` : '—'}</div>{selectedPreset.cacheReadPricePerMillionUsd != null ? <div className="text-xs text-emerald-700">cache hit ${selectedPreset.cacheReadPricePerMillionUsd}{selectedPreset.cacheWritePricePerMillionUsd != null ? ` · write $${selectedPreset.cacheWritePricePerMillionUsd}` : ''}</div> : null}</div>
                <div className="rounded-lg border p-3"><div className="text-[11px] uppercase text-muted-foreground">Пример</div><div className="font-semibold">{sampleCostUsd == null ? '—' : `≈ $${sampleCostUsd.toFixed(4)}`}</div><div className="text-[10px] text-muted-foreground">10k input + 2k output</div></div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="profile-llm-format">API format</Label>
              <select id="profile-llm-format" value={llmApiFormat} onChange={(event) => setLlmApiFormat(event.target.value as typeof llmApiFormat)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="anthropic">Anthropic Messages</option><option value="chat-completions">Chat Completions</option><option value="responses">Responses</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-llm-api-key">API key</Label>
              <Input
                id="profile-llm-api-key"
                type="password"
                value={llmApiKey}
                onChange={(event) => setLlmApiKey(event.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-llm-base-url">Base URL</Label>
              <Input
                id="profile-llm-base-url"
                value={llmBaseUrl}
                onChange={(event) => setLlmBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-llm-model">Model</Label>
              <Input
                id="profile-llm-model"
                value={llmModel}
                onChange={(event) => setLlmModel(event.target.value)}
                placeholder="gpt-4.1-mini"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void handleSaveLlm()} disabled={savingLlm}>
              {savingLlm ? 'Сохранение...' : 'Сохранить LLM настройки'}
            </Button>
          </CardContent>
        </Card>

        {/* Profile form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Основная информация</CardTitle>
            <CardDescription>Имя — единое для вашей учётной записи. Slug и «О себе» используются как публичная карточка публикаций.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Имя *</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ваше имя..."
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-slug">Slug *</Label>
              <Input
                id="profile-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="your-slug"
                className="h-11 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Уникальный идентификатор для URL: /@{slug || 'slug'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-bio">О себе</Label>
              <Textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Расскажите о себе..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <Button
          type="submit"
          disabled={saving || !name || !slug}
          className="w-full h-11 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-medium shadow-md"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Сохранить профиль
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
