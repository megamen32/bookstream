'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  PanelLeft,
  PanelRight,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { BookTextEditor } from '@/components/editor/BookTextEditor'
import type { EditorSaveStatus } from '@/components/editor/editor-types'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Chapter {
  id: string
  title: string
  position: number
  variants: ChapterVariant[]
}

interface ChapterVariant {
  id: string
  chapterId: string
  variantType: string
  contentHtml: string
  editedByAuthor: boolean
}

interface BookData {
  id: string
  title: string
  slug: string
  description: string | null
  coverUrl: string | null
  author: {
    slug: string
    name: string
  }
  isPublic: boolean
  readingModeDefault: string
  chapters: Chapter[]
  _count: { comments: number }
}

const variantTabs: Array<{ value: string; label: string; placeholder: string }> = [
  {
    value: 'original',
    label: 'Оригинал',
    placeholder: 'Начните писать оригинальный текст главы…',
  },
  {
    value: 'clean',
    label: 'Без воды',
    placeholder: 'Здесь будет облегчённая версия главы без лишнего текста…',
  },
  {
    value: 'essence',
    label: 'Суть',
    placeholder: 'Здесь будет краткая смысловая выжимка главы…',
  },
]

export default function BookEditorPage() {
  const params = useParams()
  const bookId = params.bookId as string
  const { toast } = useToast()

  const [book, setBook] = useState<BookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [activeVariant, setActiveVariant] = useState('original')
  const [editContent, setEditContent] = useState('')
  const [editChapterTitle, setEditChapterTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>('idle')
  const [generating, setGenerating] = useState(false)
  const [creatingChapter, setCreatingChapter] = useState(false)
  const [deletingChapter, setDeletingChapter] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState<'info' | 'content'>('content')
  const [chaptersPanelVisible, setChaptersPanelVisible] = useState(true)
  const [initialChapterTitle, setInitialChapterTitle] = useState('')
  const [initialChapterContent, setInitialChapterContent] = useState('')

  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(false)
  const [savingBook, setSavingBook] = useState(false)

  const fetchBook = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`/api/books/${bookId}`)

      if (!res.ok) {
        toast({ title: 'Не удалось загрузить книгу', variant: 'destructive' })
        return
      }

      const data = (await res.json()) as BookData
      const selectedExists = data.chapters.some((chapter) => chapter.id === selectedChapterId)

      setBook(data)
      setEditTitle(data.title)
      setEditDescription(data.description || '')
      setEditIsPublic(data.isPublic)
      setSelectedChapterId(selectedExists ? selectedChapterId : data.chapters[0]?.id ?? null)
    } catch (error) {
      console.error('Error fetching book:', error)
      toast({ title: 'Ошибка загрузки', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [bookId, selectedChapterId, toast])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void fetchBook()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [fetchBook])

  const selectedChapter = book?.chapters.find((chapter) => chapter.id === selectedChapterId)
  const currentVariant = selectedChapter?.variants.find(
    (variant) => variant.variantType === activeVariant
  )

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const nextTitle = selectedChapter?.title ?? ''
      const nextContent = currentVariant?.contentHtml ?? ''

      setInitialChapterTitle(nextTitle)
      setInitialChapterContent(nextContent)
      setEditContent(nextContent)
      setEditChapterTitle(nextTitle)
      setSaveStatus('idle')
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [currentVariant?.id, currentVariant?.contentHtml, selectedChapter?.title])

  const activeTab = variantTabs.find((tab) => tab.value === activeVariant)
  const chapterHasChanges =
    editChapterTitle !== initialChapterTitle || editContent !== initialChapterContent
  const bookInfoHasChanges =
    book !== null &&
    (editTitle !== book.title ||
      editDescription !== (book.description || '') ||
      editIsPublic !== book.isPublic)

  const handleEditorChange = (html: string): void => {
    setEditContent(html)
    setSaveStatus(editChapterTitle !== initialChapterTitle || html !== initialChapterContent ? 'dirty' : 'idle')
  }

  const handleChapterTitleChange = (title: string): void => {
    setEditChapterTitle(title)
    setSaveStatus(title !== initialChapterTitle || editContent !== initialChapterContent ? 'dirty' : 'idle')
  }

  const handleSaveChapter = async (): Promise<void> => {
    if (!selectedChapterId) {
      return
    }

    setSaving(true)
    setSaveStatus('saving')

    try {
      if (!editChapterTitle.trim()) {
        throw new Error('Название главы не может быть пустым')
      }

      const chapterRes = await fetch(`/api/chapters/${selectedChapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editChapterTitle }),
      })

      if (!chapterRes.ok) {
        const payload = await chapterRes.json()
        throw new Error(payload.error || 'Не удалось сохранить название главы')
      }

      const variantRes = await fetch(
        `/api/chapters/${selectedChapterId}/variants/${activeVariant}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentHtml: editContent }),
        }
      )

      if (!variantRes.ok) {
        const payload = await variantRes.json()
        throw new Error(payload.error || 'Не удалось сохранить вариант главы')
      }

      setSaveStatus('saved')
      toast({ title: 'Сохранено', description: 'Название и текст главы обновлены' })
      void fetchBook()
    } catch (error) {
      setSaveStatus('error')
      toast({
        title: 'Ошибка сохранения',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateAI = async (): Promise<void> => {
    if (!selectedChapterId) {
      return
    }

    setGenerating(true)

    try {
      const res = await fetch(`/api/chapters/${selectedChapterId}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantType: activeVariant }),
      })

      if (!res.ok) {
        throw new Error('AI generation failed')
      }

      toast({ title: 'Готово', description: 'Варианты сгенерированы' })
      await fetchBook()
      setActiveVariant('clean')
    } catch {
      toast({ title: 'Ошибка генерации', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveBook = async (): Promise<void> => {
    setSavingBook(true)

    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          slug: book?.slug,
          isPublic: editIsPublic,
        }),
      })

      if (!res.ok) {
        throw new Error('Book save failed')
      }

      toast({ title: 'Сохранено', description: 'Информация о книге обновлена' })
      void fetchBook()
    } catch {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' })
    } finally {
      setSavingBook(false)
    }
  }

  const openReaderInNewTab = (): void => {
    if (!book) {
      return
    }

    window.open(`/${book.author.slug}/${book.slug}/read`, '_blank', 'noopener,noreferrer')
  }

  const handleCreateChapter = async (): Promise<void> => {
    if (!book) {
      return
    }

    setCreatingChapter(true)

    try {
      const res = await fetch(`/api/books/${bookId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Новая глава ${book.chapters.length + 1}`,
        }),
      })

      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Не удалось создать главу')
      }

      const chapter = (await res.json()) as Chapter

      setActiveVariant('original')
      setEditMode('content')
      await fetchBook()
      setSelectedChapterId(chapter.id)

      toast({
        title: 'Глава создана',
        description: 'Откройте её и отредактируйте название или текст',
      })
    } catch (error) {
      toast({
        title: 'Ошибка создания главы',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setCreatingChapter(false)
    }
  }

  const handleDeleteChapter = async (): Promise<void> => {
    if (!book || !selectedChapterId) {
      return
    }

    const currentIndex = book.chapters.findIndex((chapter) => chapter.id === selectedChapterId)
    const fallbackChapterId =
      book.chapters[currentIndex + 1]?.id ?? book.chapters[currentIndex - 1]?.id ?? null

    setDeletingChapter(true)

    try {
      const res = await fetch(`/api/chapters/${selectedChapterId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Не удалось удалить главу')
      }

      setDeleteDialogOpen(false)
      setActiveVariant('original')
      await fetchBook()
      setSelectedChapterId(fallbackChapterId)

      toast({
        title: 'Глава удалена',
        description: 'Позиции оставшихся глав пересчитаны',
      })
    } catch (error) {
      toast({
        title: 'Ошибка удаления главы',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setDeletingChapter(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-6">
          <div className="hidden w-64 space-y-3 md:block">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-10 w-full" />
            ))}
          </div>
          <div className="flex-1">
            <Skeleton className="h-96 w-full rounded-3xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Книга не найдена</p>
        <Link href="/admin">
          <Button variant="link" className="mt-2">
            Вернуться в библиотеку
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="-ml-2 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground md:text-2xl">
            {book.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {book.chapters.length} {book.chapters.length === 1 ? 'глава' : 'глав'}
          </p>
        </div>

        <Link href={`/admin/books/${bookId}/comments`}>
          <Button variant="outline" size="sm" className="hidden rounded-full sm:flex">
            <MessageSquare className="mr-2 h-4 w-4" />
            Комментарии ({book._count.comments})
          </Button>
        </Link>

        <Button
          variant="outline"
          size="sm"
          onClick={openReaderInNewTab}
          className="hidden rounded-full sm:flex"
        >
          Читать
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setChaptersPanelVisible((current) => !current)}
          className="rounded-full"
        >
          {chaptersPanelVisible ? (
            <PanelRight className="mr-2 h-4 w-4" />
          ) : (
            <PanelLeft className="mr-2 h-4 w-4" />
          )}
          {chaptersPanelVisible ? 'Скрыть главы' : 'Показать главы'}
        </Button>
      </div>

      <div
        className={cn(
          'grid gap-6',
          chaptersPanelVisible ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-1'
        )}
      >
        <main className="min-w-0 space-y-4">
          <Card className="rounded-3xl border-border/70 bg-card/70 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4" />
                  Информация о книге
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setEditMode(editMode === 'info' ? 'content' : 'info')}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    {editMode === 'info' ? 'К главам' : 'Редактировать'}
                  </Button>

                  {editMode === 'info' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      void handleSaveBook()
                    }}
                    disabled={savingBook || !bookInfoHasChanges}
                    className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                      {savingBook ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-3 w-3" />
                      )}
                      Сохранить
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {editMode === 'info' ? (
                <div className="space-y-4">
                  {book.coverUrl && (
                    <div className="overflow-hidden rounded-3xl border">
                      <img
                        src={book.coverUrl}
                        alt={`Обложка книги «${book.title}»`}
                        className="h-56 w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Название</Label>
                    <Input
                      id="edit-title"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-desc">Описание</Label>
                    <Textarea
                      id="edit-desc"
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      rows={3}
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch checked={editIsPublic} onCheckedChange={setEditIsPublic} />
                    <Label className="text-sm">
                      {editIsPublic ? (
                        <span className="flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5" /> Публичная
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <EyeOff className="h-3.5 w-3.5" /> Черновик
                        </span>
                      )}
                    </Label>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{book.title}</h3>
                    {book.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{book.description}</p>
                    )}
                    {book.coverUrl && (
                      <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                        Обложка прикреплена
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={book.isPublic ? 'default' : 'secondary'}
                    className="shrink-0 rounded-full"
                  >
                    {book.isPublic ? 'Публичная' : 'Черновик'}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedChapter ? (
            <Card className="rounded-3xl border-border/70 bg-card/70 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{selectedChapter.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Telegraph-like редактор · сохраняется как HTML
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={deletingChapter}
                      className="rounded-full"
                    >
                      {deletingChapter ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 h-3 w-3" />
                      )}
                      Удалить
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setGenerateDialogOpen(true)
                      }}
                      disabled={generating}
                      className="w-fit rounded-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      {generating ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3" />
                      )}
                      Сгенерировать AI
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <Tabs value={activeVariant} onValueChange={setActiveVariant}>
                  <TabsList className="mb-4 rounded-full">
                    {variantTabs.map((tab) => {
                      const hasVariant = selectedChapter.variants.some(
                        (variant) => variant.variantType === tab.value
                      )

                      return (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className="rounded-full text-xs sm:text-sm"
                        >
                          {tab.label}
                          {hasVariant && <Check className="ml-1 h-3 w-3 text-emerald-600" />}
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>

                  {variantTabs.map((tab) => (
                    <TabsContent key={tab.value} value={tab.value} className="mt-0">
                      <BookTextEditor
                        value={activeVariant === tab.value ? editContent : ''}
                        title={editChapterTitle}
                        onChange={handleEditorChange}
                        onTitleChange={handleChapterTitleChange}
                        titlePlaceholder="Название главы"
                        placeholder={activeTab?.placeholder || tab.placeholder}
                        onSave={handleSaveChapter}
                        saving={saving}
                        saveStatus={saveStatus}
                        saveDisabled={!chapterHasChanges}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-3xl p-8 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Выберите главу для редактирования</p>
            </Card>
          )}
        </main>

        <aside
          className={cn(
            'w-full',
            chaptersPanelVisible ? 'block' : 'hidden',
            'lg:sticky lg:top-6 lg:self-start'
          )}
        >
          <Card className="rounded-3xl border-border/70 bg-card/70 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Главы</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void handleCreateChapter()
                  }}
                  disabled={creatingChapter}
                  className="rounded-full"
                >
                  {creatingChapter ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Глава
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden p-2">
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-1">
                  {book.chapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      onClick={() => {
                        const nextVariant = chapter.variants.some(
                          (variant) => variant.variantType === activeVariant
                        )
                          ? activeVariant
                          : 'original'

                        setActiveVariant(nextVariant)
                        setSelectedChapterId(chapter.id)
                        setEditMode('content')
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 overflow-hidden rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                        selectedChapterId === chapter.id
                          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                        {chapter.position + 1}.
                      </span>
                      <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                      {chapter.variants.length > 1 && (
                        <Badge
                          variant="secondary"
                          className="ml-auto rounded-full px-1.5 py-0 text-[10px]"
                        >
                          {chapter.variants.length}
                        </Badge>
                      )}
                    </button>
                  ))}

                  {book.chapters.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">Нет глав</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить главу?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedChapter
                ? `Глава «${selectedChapter.title}» будет удалена вместе с вариантами, комментариями и реакциями.`
                : 'Глава будет удалена без возможности восстановления.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteChapter()
              }}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingChapter ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              Сгенерировать только эту версию?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Будет обновлена только версия <strong>{activeTab?.label || activeVariant}</strong>.
              </span>
              {currentVariant?.editedByAuthor && (
                <span className="block text-destructive">
                  Сейчас в этой версии есть авторские правки. Генерация перезапишет их.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                setGenerateDialogOpen(false)
                void handleGenerateAI()
              }}
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Сгенерировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-4 sm:hidden">
        <Link href={`/admin/books/${bookId}/comments`} className="block">
          <Button variant="outline" className="w-full rounded-full">
            <MessageSquare className="mr-2 h-4 w-4" />
            Комментарии ({book._count.comments})
          </Button>
        </Link>
      </div>
    </div>
  )
}
