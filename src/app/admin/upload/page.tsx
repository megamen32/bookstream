'use client'

import { type DragEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, File, FileText, FileType2, ImagePlus, Loader2, Upload, X } from 'lucide-react'
import { BookCoverSection } from '@/components/admin/BookCoverSection'
import { BookMetadataSection } from '@/components/admin/BookMetadataSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const BOOK_ACCEPTED_EXTENSIONS = ['.docx', '.md', '.txt'] as const
const COVER_ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'] as const
const COVER_ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

interface UploadAuthor {
  id: string
  slug: string
  name: string
  bio?: string | null
}

interface ImportPreview {
  title: string | null
  description: string | null
  coverDataUrl: string | null
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, (match) => {
      const map: Record<string, string> = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
        ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
        н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
        ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
        ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
      }
      return map[match] || match
    })
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function getFileIcon(name: string) {
  if (name.endsWith('.docx')) return <FileType2 className="h-8 w-8 text-blue-500" />
  if (name.endsWith('.md')) return <FileText className="h-8 w-8 text-purple-500" />
  return <File className="h-8 w-8 text-gray-500" />
}

function getExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return extension ? `.${extension}` : ''
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export default function AdminUploadPage() {
  const [authors, setAuthors] = useState<UploadAuthor[]>([])
  const [authorsLoading, setAuthorsLoading] = useState(true)
  const [authorMode, setAuthorMode] = useState<'existing' | 'new'>('existing')
  const [authorSlug, setAuthorSlug] = useState('')
  const [newAuthorName, setNewAuthorName] = useState('')
  const [newAuthorSlug, setNewAuthorSlug] = useState('')
  const [newAuthorBio, setNewAuthorBio] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [readingMode, setReadingMode] = useState('feed')
  const [file, setFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [suggestedCoverDataUrl, setSuggestedCoverDataUrl] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [step, setStep] = useState<'form' | 'creating' | 'uploading' | 'done'>('form')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const previewRequestIdRef = useRef(0)
  const coverFileRef = useRef<File | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    async function loadAuthors(): Promise<void> {
      try {
        const response = await fetch('/api/authors')
        if (!response.ok) {
          throw new Error('Не удалось загрузить авторов')
        }

        const data = (await response.json()) as UploadAuthor[]
        setAuthors(data)

        if (data.length === 1) {
          setAuthorSlug(data[0].slug)
        }

        if (data.length === 0) {
          setAuthorMode('new')
        }
      } catch (error: unknown) {
        toast({
          title: 'Ошибка',
          description: error instanceof Error ? error.message : 'Не удалось загрузить авторов',
          variant: 'destructive',
        })
      } finally {
        setAuthorsLoading(false)
      }
    }

    void loadAuthors()
  }, [toast])

  useEffect(() => (
    () => {
      if (coverPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl)
      }
    }
  ), [coverPreviewUrl])

  useEffect(() => {
    coverFileRef.current = coverFile
  }, [coverFile])

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value)
    if (!slug || slug === slugify(title)) {
      setSlug(slugify(value))
    }
  }, [slug, title])

  const handleNewAuthorNameChange = useCallback((value: string) => {
    setNewAuthorName(value)
    setNewAuthorSlug((currentSlug) => {
      if (!currentSlug || currentSlug === slugify(newAuthorName)) {
        return slugify(value)
      }
      return currentSlug
    })
  }, [newAuthorName])

  const replaceManualCoverPreview = useCallback((nextPreviewUrl: string | null) => {
    setCoverPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(currentPreviewUrl)
      }
      return nextPreviewUrl
    })
  }, [])

  const applyImportPreview = useCallback((preview: ImportPreview) => {
    if (preview.title) {
      setTitle((currentTitle) => {
        if (currentTitle.trim()) {
          return currentTitle
        }

        setSlug((currentSlug) => {
          if (!currentSlug || currentSlug === slugify(currentTitle)) {
            return slugify(preview.title || '')
          }
          return currentSlug
        })

        return preview.title || currentTitle
      })
    }

    if (preview.description) {
      setDescription((currentDescription) => (
        currentDescription.trim() ? currentDescription : preview.description || currentDescription
      ))
    }

    if (preview.coverDataUrl && !coverFileRef.current) {
      setSuggestedCoverDataUrl(preview.coverDataUrl)
    }
  }, [])

  const fetchImportPreview = useCallback(async (selectedFile: File) => {
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId
    setPreviewLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/books/import-preview', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Не удалось получить подсказки из файла')
      }

      const preview = (await response.json()) as ImportPreview
      if (previewRequestIdRef.current !== requestId) {
        return
      }

      applyImportPreview(preview)
    } catch (error) {
      console.error('Failed to fetch import preview:', error)
    } finally {
      if (previewRequestIdRef.current === requestId) {
        setPreviewLoading(false)
      }
    }
  }, [applyImportPreview])

  const handleFileSelect = useCallback((selectedFile: File) => {
    const extension = getExtension(selectedFile.name)

    if (!BOOK_ACCEPTED_EXTENSIONS.includes(extension as typeof BOOK_ACCEPTED_EXTENSIONS[number])) {
      toast({
        title: 'Неподдерживаемый формат',
        description: 'Поддерживаются файлы .docx, .md и .txt',
        variant: 'destructive',
      })
      return
    }

    setFile(selectedFile)
    if (!coverFile) {
      setSuggestedCoverDataUrl(null)
    }
    void fetchImportPreview(selectedFile)
  }, [coverFile, fetchImportPreview, toast])

  const handleCoverSelect = useCallback((selectedCoverFile: File) => {
    const extension = getExtension(selectedCoverFile.name)

    if (
      !COVER_ACCEPTED_MIME_TYPES.includes(selectedCoverFile.type as typeof COVER_ACCEPTED_MIME_TYPES[number]) &&
      !COVER_ACCEPTED_EXTENSIONS.includes(extension as typeof COVER_ACCEPTED_EXTENSIONS[number])
    ) {
      toast({
        title: 'Неподдерживаемая обложка',
        description: 'Выберите изображение в формате JPG, PNG, WEBP или AVIF',
        variant: 'destructive',
      })
      return
    }

    setCoverFile(selectedCoverFile)
    replaceManualCoverPreview(URL.createObjectURL(selectedCoverFile))
  }, [replaceManualCoverPreview, toast])

  const clearManualCover = useCallback(() => {
    setCoverFile(null)
    replaceManualCoverPreview(null)
  }, [replaceManualCoverPreview])

  const handleDrag = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true)
      return
    }

    setDragActive(false)
  }, [])

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!title || !slug || !file) {
      return
    }

    setCreating(true)
    setStep('creating')

    try {
      let targetAuthorSlug = authorSlug

      if (authorMode === 'new') {
        if (!newAuthorName.trim() || !newAuthorSlug.trim()) {
          throw new Error('Укажите имя и slug автора')
        }

        const authorResponse = await fetch('/api/authors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newAuthorName.trim(),
            slug: newAuthorSlug.trim(),
            bio: newAuthorBio.trim(),
          }),
        })

        if (!authorResponse.ok) {
          const payload = await authorResponse.json()
          throw new Error(payload.error || 'Ошибка создания автора')
        }

        const createdAuthor = (await authorResponse.json()) as UploadAuthor
        setAuthors((currentAuthors) => [createdAuthor, ...currentAuthors])
        setAuthorSlug(createdAuthor.slug)
        setAuthorMode('existing')
        targetAuthorSlug = createdAuthor.slug
      }

      if (!targetAuthorSlug) {
        throw new Error('Выберите автора')
      }

      const bookResponse = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorSlug: targetAuthorSlug,
          title,
          slug,
          description,
          readingModeDefault: readingMode,
        }),
      })

      if (!bookResponse.ok) {
        const payload = await bookResponse.json()
        throw new Error(payload.error || 'Ошибка создания книги')
      }

      const createdBook = (await bookResponse.json()) as { id: string }
      setCreating(false)
      setUploading(true)
      setStep('uploading')

      const formData = new FormData()
      formData.append('file', file)

      if (coverFile) {
        formData.append('cover', coverFile)
      } else if (suggestedCoverDataUrl) {
        formData.append('suggestedCoverDataUrl', suggestedCoverDataUrl)
      }

      let progress = 0
      const intervalId = window.setInterval(() => {
        progress = Math.min(progress + Math.random() * 15, 90)
        setUploadProgress(progress)
      }, 300)

      const uploadResponse = await fetch(`/api/books/${createdBook.id}/upload`, {
        method: 'POST',
        body: formData,
      })

      window.clearInterval(intervalId)
      setUploadProgress(100)

      if (!uploadResponse.ok) {
        const payload = await uploadResponse.json()
        throw new Error(payload.error || 'Ошибка загрузки файла')
      }

      const uploadData = (await uploadResponse.json()) as { chaptersCreated: number; coverAttached: boolean }
      setUploading(false)
      setStep('done')

      toast({
        title: 'Книга загружена!',
        description: uploadData.coverAttached
          ? `Создано ${uploadData.chaptersCreated} глав, обложка прикреплена`
          : `Создано ${uploadData.chaptersCreated} глав`,
      })

      window.setTimeout(() => {
        router.push(`/admin/books/${createdBook.id}`)
      }, 1500)
    } catch (error: unknown) {
      setCreating(false)
      setUploading(false)
      setStep('form')
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Произошла ошибка',
        variant: 'destructive',
      })
    }
  }, [
    authorMode,
    authorSlug,
    coverFile,
    description,
    file,
    newAuthorBio,
    newAuthorName,
    newAuthorSlug,
    readingMode,
    router,
    slug,
    suggestedCoverDataUrl,
    title,
    toast,
  ])

  const effectiveCoverPreview = coverPreviewUrl || suggestedCoverDataUrl
  const authorReady = authorMode === 'new'
    ? Boolean(newAuthorName.trim() && newAuthorSlug.trim())
    : Boolean(authorSlug)

  if (step === 'done') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold">Книга успешно загружена!</h2>
        <p className="text-muted-foreground">Перенаправляем в редактор...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 lg:p-8">
      <input
        ref={fileInputRef}
        type="file"
        accept={BOOK_ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0]
          if (selectedFile) {
            handleFileSelect(selectedFile)
          }
          event.currentTarget.value = ''
        }}
      />

      <input
        ref={coverInputRef}
        type="file"
        accept={COVER_ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        onChange={(event) => {
          const selectedCoverFile = event.target.files?.[0]
          if (selectedCoverFile) {
            handleCoverSelect(selectedCoverFile)
          }
          event.currentTarget.value = ''
        }}
      />

      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="-ml-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Загрузить книгу</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Сначала бросьте файл, потом проверьте автозаполненные поля
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Файл книги</CardTitle>
            <CardDescription>
              Основной сценарий: загрузить файл первым. Поддерживаются .docx, .md, .txt
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                {getFileIcon(file.name)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  {previewLoading && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Пытаемся вытащить название, описание и обложку
                    </p>
                  )}
                </div>
                {step === 'form' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      previewRequestIdRef.current += 1
                      setPreviewLoading(false)
                      setFile(null)
                      if (!coverFileRef.current) {
                        setSuggestedCoverDataUrl(null)
                      }
                    }}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                  dragActive
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50/50'
                )}
              >
                <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Перетащите файл сюда или нажмите для выбора</p>
                <p className="mt-1 text-xs text-muted-foreground">.docx, .md, .txt</p>
              </div>
            )}
          </CardContent>
        </Card>

        <BookCoverSection
          description="Можно выбрать вручную. Если не выбрать, попробуем взять первую картинку из файла."
          previewUrl={effectiveCoverPreview}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => coverInputRef.current?.click()}
                disabled={step !== 'form'}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                {coverFile ? 'Заменить обложку' : 'Выбрать обложку'}
              </Button>

              {coverFile ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearManualCover}
                  disabled={step !== 'form'}
                >
                  <X className="mr-2 h-4 w-4" />
                  Убрать ручную обложку
                </Button>
              ) : null}
            </>
          }
          helperText="Ручная обложка имеет приоритет. Автонайденная используется только если вы сами ничего не выбрали."
        />

        <BookMetadataSection
          description="Пустые поля мы пытаемся заполнить из загруженного файла"
          idPrefix="upload-book"
          titleValue={title}
          onTitleChange={handleTitleChange}
          slugValue={slug}
          onSlugChange={setSlug}
          descriptionValue={description}
          onDescriptionChange={setDescription}
          readingMode={readingMode}
          onReadingModeChange={setReadingMode}
          disabled={step !== 'form'}
          beforeFields={
            <div className="space-y-2">
              <Label>Автор *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={authorMode === 'existing' ? 'default' : 'outline'}
                  onClick={() => setAuthorMode('existing')}
                  disabled={step !== 'form' || authorsLoading || authors.length === 0}
                  className="flex-1"
                >
                  Выбрать
                </Button>
                <Button
                  type="button"
                  variant={authorMode === 'new' ? 'default' : 'outline'}
                  onClick={() => setAuthorMode('new')}
                  disabled={step !== 'form'}
                  className="flex-1"
                >
                  Новый автор
                </Button>
              </div>

              {authorMode === 'existing' ? (
                <Select
                  value={authorSlug}
                  onValueChange={setAuthorSlug}
                  disabled={step !== 'form' || authorsLoading || authors.length === 0}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue
                      placeholder={
                        authorsLoading
                          ? 'Загрузка авторов...'
                          : authors.length === 0
                            ? 'Нет авторов, создайте нового'
                            : 'Выберите автора'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {authors.map((author) => (
                      <SelectItem key={author.id} value={author.slug}>
                        {author.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-author-name">Имя автора *</Label>
                    <Input
                      id="new-author-name"
                      value={newAuthorName}
                      onChange={(event) => handleNewAuthorNameChange(event.target.value)}
                      placeholder="Например, Фёдор Достоевский"
                      disabled={step !== 'form'}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-author-slug">Slug автора *</Label>
                    <Input
                      id="new-author-slug"
                      value={newAuthorSlug}
                      onChange={(event) => setNewAuthorSlug(event.target.value)}
                      placeholder="fedor-dostoevsky"
                      disabled={step !== 'form'}
                      className="h-11 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-author-bio">О себе</Label>
                    <Textarea
                      id="new-author-bio"
                      value={newAuthorBio}
                      onChange={(event) => setNewAuthorBio(event.target.value)}
                      placeholder="Краткая биография автора..."
                      disabled={step !== 'form'}
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          }
        />

        {(creating || uploading) && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                {creating ? 'Создание книги...' : 'Обработка файла...'}
              </div>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {creating ? 'Подготовка к загрузке...' : `Загружено: ${Math.round(uploadProgress)}%`}
              </p>
            </CardContent>
          </Card>
        )}

        <Button
          type="submit"
          disabled={!authorReady || !title || !slug || !file || step !== 'form'}
          className="h-11 w-full bg-gradient-to-r from-amber-600 to-orange-600 font-medium text-white shadow-md hover:from-amber-700 hover:to-orange-700"
        >
          {creating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Создание...
            </>
          ) : uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Загрузка...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Создать и загрузить
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
