'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft,
  Save,
  Sparkles,
  Loader2,
  MessageSquare,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Pencil,
} from 'lucide-react'
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
  isPublic: boolean
  readingModeDefault: string
  chapters: Chapter[]
  _count: { comments: number }
}

const variantLabels: Record<string, string> = {
  original: 'Оригинал',
  clean: 'Без воды',
  essence: 'Суть',
}

const variantTabs: Array<{ value: string; label: string }> = [
  { value: 'original', label: 'Оригинал' },
  { value: 'clean', label: 'Без воды' },
  { value: 'essence', label: 'Суть' },
]

export default function BookEditorPage() {
  const params = useParams()
  const router = useRouter()
  const bookId = params.bookId as string
  const { toast } = useToast()

  const [book, setBook] = useState<BookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [activeVariant, setActiveVariant] = useState('original')
  const [editContent, setEditContent] = useState('')
  const [editChapterTitle, setEditChapterTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editMode, setEditMode] = useState<'info' | 'content'>('content')

  // Book edit fields
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(false)
  const [savingBook, setSavingBook] = useState(false)

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/books/${bookId}`)
      if (res.ok) {
        const data = await res.json()
        setBook(data)
        setEditTitle(data.title)
        setEditDescription(data.description || '')
        setEditIsPublic(data.isPublic)
        if (data.chapters.length > 0 && !selectedChapterId) {
          setSelectedChapterId(data.chapters[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching book:', error)
    } finally {
      setLoading(false)
    }
  }, [bookId, selectedChapterId])

  useEffect(() => {
    const run = async () => {
      await fetchBook()
    }
    void run()
  }, [fetchBook])

  const selectedChapter = book?.chapters.find((c) => c.id === selectedChapterId)

  const currentVariant = selectedChapter?.variants.find(
    (v) => v.variantType === activeVariant
  )

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setEditContent(currentVariant?.contentHtml ?? '')
      setEditChapterTitle(selectedChapter?.title ?? '')
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [currentVariant, selectedChapter])

  const handleSaveChapter = async () => {
    if (!selectedChapterId) return
    setSaving(true)
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

      toast({ title: 'Сохранено', description: 'Название и текст главы обновлены' })
      fetchBook()
    } catch (error) {
      toast({
        title: 'Ошибка сохранения',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateAI = async () => {
    if (!selectedChapterId) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/chapters/${selectedChapterId}/summarize`, {
        method: 'POST',
      })
      if (res.ok) {
        toast({ title: 'Готово!', description: 'Варианты сгенерированы' })
        fetchBook()
        // Switch to clean variant to show result
        setActiveVariant('clean')
      }
    } catch {
      toast({ title: 'Ошибка генерации', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveBook = async () => {
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
      if (res.ok) {
        toast({ title: 'Сохранено', description: 'Информация о книге обновлена' })
        fetchBook()
      }
    } catch {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' })
    } finally {
      setSavingBook(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-8 h-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-6">
          <div className="w-64 hidden md:block space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <div className="flex-1">
            <Skeleton className="h-64 w-full" />
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
          <Button variant="link" className="mt-2">Вернуться в библиотеку</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="-ml-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">
            {book.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {book.chapters.length} {book.chapters.length === 1 ? 'глава' : 'глав'}
          </p>
        </div>
        <Link href={`/admin/books/${bookId}/comments`}>
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <MessageSquare className="w-4 h-4 mr-2" />
            Комментарии ({book._count.comments})
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Chapter sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Главы
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-0.5">
                  {book.chapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      onClick={() => {
                        setSelectedChapterId(chapter.id)
                        setEditMode('content')
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2',
                        selectedChapterId === chapter.id
                          ? 'bg-amber-100 text-amber-900 font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <span className="w-5 text-xs text-muted-foreground font-mono shrink-0">
                        {chapter.position + 1}.
                      </span>
                      <span className="truncate">{chapter.title}</span>
                      {chapter.variants.length > 1 && (
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                          {chapter.variants.length}
                        </Badge>
                      )}
                    </button>
                  ))}
                  {book.chapters.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Нет глав
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Book info section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Информация о книге
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditMode(editMode === 'info' ? 'content' : 'info')}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    {editMode === 'info' ? 'К главам' : 'Редактировать'}
                  </Button>
                  {editMode === 'info' && (
                    <Button
                      size="sm"
                      onClick={handleSaveBook}
                      disabled={savingBook}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {savingBook ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3 mr-1" />
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
                    <div className="overflow-hidden rounded-xl border">
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
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-desc">Описание</Label>
                    <Textarea
                      id="edit-desc"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={editIsPublic}
                      onCheckedChange={setEditIsPublic}
                    />
                    <Label className="text-sm">
                      {editIsPublic ? (
                        <span className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" /> Публичная
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5" /> Черновик
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
                      <p className="text-sm text-muted-foreground mt-1">{book.description}</p>
                    )}
                    {book.coverUrl && (
                      <p className="mt-2 text-xs text-emerald-700">Обложка прикреплена</p>
                    )}
                  </div>
                  <Badge variant={book.isPublic ? 'default' : 'secondary'} className="shrink-0">
                    {book.isPublic ? 'Публичная' : 'Черновик'}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chapter editor */}
          {selectedChapter ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {selectedChapter.title}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAI}
                      disabled={generating}
                      className="text-amber-700 border-amber-300 hover:bg-amber-50"
                    >
                      {generating ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1" />
                      )}
                      Сгенерировать AI
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveChapter}
                      disabled={saving || !editContent || !editChapterTitle.trim()}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {saving ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3 mr-1" />
                      )}
                      Сохранить
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 space-y-2">
                  <Label htmlFor="chapter-title">Название главы</Label>
                  <Input
                    id="chapter-title"
                    value={editChapterTitle}
                    onChange={(e) => setEditChapterTitle(e.target.value)}
                    placeholder="Название главы..."
                  />
                </div>
                <Tabs value={activeVariant} onValueChange={setActiveVariant}>
                  <TabsList className="mb-4">
                    {variantTabs.map((tab) => {
                      const hasVariant = selectedChapter.variants.some(
                        (v) => v.variantType === tab.value
                      )
                      return (
                        <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
                          {tab.label}
                          {hasVariant && (
                            <Check className="w-3 h-3 ml-1 text-green-600" />
                          )}
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>

                  {variantTabs.map((tab) => (
                    <TabsContent key={tab.value} value={tab.value}>
                      <textarea
                        value={activeVariant === tab.value ? editContent : ''}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full min-h-[400px] p-4 rounded-lg border border-input bg-background text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                        placeholder={
                          tab.value === 'original'
                            ? 'Оригинальный текст главы...'
                            : tab.value === 'clean'
                            ? 'Текст без воды (сгенерируйте AI)'
                            : 'Суть главы (сгенерируйте AI)'
                        }
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Выберите главу для редактирования</p>
            </Card>
          )}
        </div>
      </div>

      {/* Mobile comment link */}
      <div className="sm:hidden mt-4">
        <Link href={`/admin/books/${bookId}/comments`} className="block">
          <Button variant="outline" className="w-full">
            <MessageSquare className="w-4 h-4 mr-2" />
            Комментарии ({book._count.comments})
          </Button>
        </Link>
      </div>
    </div>
  )
}
