'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Palette, Sparkles, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface VariantPreset {
  id: string
  slug: string
  label: string
  emoji: string
  description: string
  targetSizePercent: number | null
  position: number
  systemPromptTemplate: string
  createdAt: string
}

interface PresetFormData {
  slug: string
  label: string
  emoji: string
  description: string
  targetSizePercent: string
  position: string
  systemPromptTemplate: string
}

const emptyForm: PresetFormData = {
  slug: '',
  label: '',
  emoji: '',
  description: '',
  targetSizePercent: '',
  position: '0',
  systemPromptTemplate: '',
}

function presetToForm(preset: VariantPreset): PresetFormData {
  return {
    slug: preset.slug,
    label: preset.label,
    emoji: preset.emoji,
    description: preset.description,
    targetSizePercent: preset.targetSizePercent !== null ? String(preset.targetSizePercent) : '',
    position: String(preset.position),
    systemPromptTemplate: preset.systemPromptTemplate,
  }
}

function formToPayload(form: PresetFormData) {
  return {
    slug: form.slug,
    label: form.label,
    emoji: form.emoji,
    description: form.description,
    targetSizePercent: form.targetSizePercent ? Number(form.targetSizePercent) : null,
    position: Number(form.position) || 0,
    systemPromptTemplate: form.systemPromptTemplate,
  }
}

export default function AdminVariantsPage() {
  const [presets, setPresets] = useState<VariantPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<VariantPreset | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<VariantPreset | null>(null)
  const [form, setForm] = useState<PresetFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Generate progress
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 })

  const { toast } = useToast()

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/variant-presets')
      if (res.ok) {
        const data = await res.json()
        setPresets(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching presets:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await fetchPresets()
    }
    void run()
  }, [fetchPresets])

  // --- Delete ---
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/variant-presets/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Пресет удалён' })
        setPresets((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      } else {
        toast({ title: 'Ошибка удаления', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка удаления', variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // --- Form open/close ---
  const openCreateForm = () => {
    setEditingPreset(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEditForm = (preset: VariantPreset) => {
    setEditingPreset(preset)
    setForm(presetToForm(preset))
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingPreset(null)
    setForm(emptyForm)
  }

  // --- Save (create or update) ---
  const handleSave = async () => {
    if (!form.slug.trim() || !form.label.trim()) {
      toast({ title: 'Заполните обязательные поля (slug, label)', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload = formToPayload(form)
      let res: Response

      if (editingPreset) {
        res = await fetch(`/api/variant-presets/${editingPreset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/variant-presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        toast({ title: editingPreset ? 'Пресет обновлён' : 'Пресет создан' })
        closeForm()
        fetchPresets()
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: err.error || 'Ошибка сохранения', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // --- Generate for all chapters ---
  const handleGenerateAll = async () => {
    if (generating) return
    setGenerating(true)
    setGenProgress({ current: 0, total: 0 })

    try {
      // 1. Fetch all books
      const booksRes = await fetch('/api/books')
      if (!booksRes.ok) throw new Error('Не удалось загрузить книги')
      const books = await booksRes.json()

      // 2. Collect all chapters across all books
      const allChapters: { bookId: string; chapterId: string }[] = []
      for (const book of books) {
        const chaptersRes = await fetch(`/api/books/${book.id}/chapters`)
        if (chaptersRes.ok) {
          const chapters = await chaptersRes.json()
          const chapterArray = Array.isArray(chapters) ? chapters : []
          for (const chapter of chapterArray) {
            allChapters.push({ bookId: book.id, chapterId: chapter.id })
          }
        }
      }

      setGenProgress({ current: 0, total: allChapters.length })

      // 3. Summarize each chapter
      for (let i = 0; i < allChapters.length; i++) {
        const { chapterId } = allChapters[i]
        try {
          await fetch(`/api/chapters/${chapterId}/summarize`, { method: 'POST' })
        } catch {
          // Continue even if one fails
        }
        setGenProgress({ current: i + 1, total: allChapters.length })
      }

      toast({ title: 'Генерация вариантов завершена' })
    } catch (error) {
      console.error('Generate error:', error)
      toast({ title: 'Ошибка генерации', variant: 'destructive' })
    } finally {
      setGenerating(false)
      setGenProgress({ current: 0, total: 0 })
    }
  }

  // --- Update form field ---
  const updateField = (field: keyof PresetFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Варианты</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управление пресетами вариантов для генерации
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerateAll}
            disabled={generating || loading}
            className="text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {generating
              ? `Генерация... ${genProgress.current}/${genProgress.total}`
              : 'Генерировать для всех глав'}
          </Button>
          <Button
            onClick={openCreateForm}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить пресет
          </Button>
        </div>
      </div>

      {/* Generation progress */}
      {generating && genProgress.total > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-amber-800">
                Генерация вариантов для всех глав...
              </span>
              <span className="text-amber-700">
                {genProgress.current} / {genProgress.total}
              </span>
            </div>
            <Progress value={(genProgress.current / genProgress.total) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Presets list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-72" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : presets.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Palette className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Нет пресетов</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Создайте первый пресет варианта, чтобы настроить генерацию
          </p>
          <Button
            onClick={openCreateForm}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Создать пресет
          </Button>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                          Пресет
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                          Slug
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                          Размер
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                          Позиция
                        </th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {presets
                        .sort((a, b) => a.position - b.position)
                        .map((preset) => (
                          <tr
                            key={preset.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{preset.emoji || '📝'}</span>
                                <div>
                                  <p className="font-medium text-sm">{preset.label}</p>
                                  {preset.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                                      {preset.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {preset.slug}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={
                                  preset.targetSizePercent
                                    ? 'border-amber-300 text-amber-700'
                                    : 'border-gray-300 text-gray-500'
                                }
                              >
                                {preset.targetSizePercent ? `${preset.targetSizePercent}%` : 'auto'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {preset.position}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => openEditForm(preset)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteTarget(preset)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {presets
              .sort((a, b) => a.position - b.position)
              .map((preset) => (
                <Card key={preset.id} className="border border-gray-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{preset.emoji || '📝'}</span>
                        <div>
                          <h3 className="font-semibold text-sm">{preset.label}</h3>
                          <Badge variant="secondary" className="font-mono text-xs mt-1">
                            {preset.slug}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditForm(preset)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(preset)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {preset.description && (
                      <p className="text-sm text-muted-foreground">{preset.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className={
                          preset.targetSizePercent
                            ? 'border-amber-300 text-amber-700'
                            : 'border-gray-300 text-gray-500'
                        }
                      >
                        {preset.targetSizePercent ? `${preset.targetSizePercent}%` : 'auto'}
                      </Badge>
                      <span>Позиция: {preset.position}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); else setFormOpen(true) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-amber-600" />
              {editingPreset ? 'Редактировать пресет' : 'Новый пресет'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                placeholder="brief, detailed, simple..."
                className="font-mono"
              />
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">
                Название <span className="text-destructive">*</span>
              </Label>
              <Input
                id="label"
                value={form.label}
                onChange={(e) => updateField('label', e.target.value)}
                placeholder="Краткое содержание, Подробный пересказ..."
              />
            </div>

            {/* Emoji */}
            <div className="space-y-2">
              <Label htmlFor="emoji">Эмодзи</Label>
              <Input
                id="emoji"
                value={form.emoji}
                onChange={(e) => updateField('emoji', e.target.value)}
                placeholder="📖 ⚡ 🎯 ..."
                className="w-24 text-center text-2xl"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Краткое описание пресета..."
                rows={3}
              />
            </div>

            {/* targetSizePercent & Position */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetSizePercent">Целевой размер (%)</Label>
                <Input
                  id="targetSizePercent"
                  type="number"
                  value={form.targetSizePercent}
                  onChange={(e) => updateField('targetSizePercent', e.target.value)}
                  placeholder="Оставьте пустым для auto"
                  min={1}
                  max={200}
                />
                <p className="text-xs text-muted-foreground">
                  Процент от оригинального размера. Пусто = auto.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Позиция</Label>
                <Input
                  id="position"
                  type="number"
                  value={form.position}
                  onChange={(e) => updateField('position', e.target.value)}
                  placeholder="0"
                  min={0}
                />
                <p className="text-xs text-muted-foreground">Порядок отображения</p>
              </div>
            </div>

            {/* systemPromptTemplate */}
            <div className="space-y-2">
              <Label htmlFor="systemPromptTemplate">Шаблон системного промпта</Label>
              <Textarea
                id="systemPromptTemplate"
                value={form.systemPromptTemplate}
                onChange={(e) => updateField('systemPromptTemplate', e.target.value)}
                placeholder="Ты — эксперт по пересказу..."
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-md px-3 py-2">
                Используйте <code className="font-bold">{'{word_count}'}</code> для подстановки
                целевого количества слов (только если указан targetSizePercent)
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Отмена
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {editingPreset ? 'Сохранить' : 'Создать'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пресет?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить пресет «{deleteTarget?.label}»?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
