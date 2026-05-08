'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, Loader2, ShieldCheck, User } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { slugify } from '@/lib/slugify'

interface Author {
  id: string
  name: string
  slug: string
  bio: string | null
}

interface AdminSettingsPayload {
  settings: {
    allowUserPublishing: boolean
  }
  reader: {
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

  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/authors')
      .then((res) => res.json())
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
  }, [])

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(async (res) => {
        if (!res.ok) {
          return null
        }
        return await res.json() as AdminSettingsPayload
      })
      .then((payload) => {
        if (!payload) {
          return
        }

        setIsMainAdmin(payload.reader.isMainAdmin)
        setAllowUserPublishing(payload.settings.allowUserPublishing)
      })
      .catch(console.error)
  }, [])

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
      const method = author ? 'PUT' : 'POST'
      const res = await fetch('/api/authors', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, bio }),
      })

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
    } catch {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' })
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
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowUserPublishing: checked,
        }),
      })

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
        <h1 className="text-2xl font-bold text-foreground">Профиль автора</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Управляйте информацией о себе
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

        {/* Profile form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Основная информация</CardTitle>
            <CardDescription>Данные отображаются в публичном профиле</CardDescription>
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
