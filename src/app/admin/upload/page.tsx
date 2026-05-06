'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, File, FileType2, X, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, (match) => {
      const map: Record<string, string> = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      }
      return map[match] || match
    })
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function getFileIcon(name: string) {
  if (name.endsWith('.docx')) return <FileType2 className="w-8 h-8 text-blue-500" />
  if (name.endsWith('.md')) return <FileText className="w-8 h-8 text-purple-500" />
  return <File className="w-8 h-8 text-gray-500" />
}

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
]

const ACCEPTED_EXTENSIONS = ['.docx', '.md', '.txt']

export default function AdminUploadPage() {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [readingMode, setReadingMode] = useState('feed')
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [step, setStep] = useState<'form' | 'creating' | 'uploading' | 'done'>('form')
  const [createdBookId, setCreatedBookId] = useState('')
  const router = useRouter()
  const { toast } = useToast()

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!slug || slug === slugify(title)) {
      setSlug(slugify(value))
    }
  }

  const handleFileSelect = (f: File) => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast({
        title: 'Неподдерживаемый формат',
        description: 'Поддерживаются файлы .docx, .md и .txt',
        variant: 'destructive',
      })
      return
    }
    setFile(f)
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !slug || !file) return

    setCreating(true)
    setStep('creating')

    try {
      // Create book
      const bookRes = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          description,
          readingModeDefault: readingMode,
        }),
      })

      if (!bookRes.ok) {
        const data = await bookRes.json()
        throw new Error(data.error || 'Ошибка создания книги')
      }

      const book = await bookRes.json()
      setCreatedBookId(book.id)
      setCreating(false)
      setUploading(true)
      setStep('uploading')

      // Upload file
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress
      let progress = 0
      const interval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 15, 90)
        setUploadProgress(progress)
      }, 300)

      const uploadRes = await fetch(`/api/books/${book.id}/upload`, {
        method: 'POST',
        body: formData,
      })

      clearInterval(interval)
      setUploadProgress(100)

      if (!uploadRes.ok) {
        const data = await uploadRes.json()
        throw new Error(data.error || 'Ошибка загрузки файла')
      }

      const uploadData = await uploadRes.json()
      setUploading(false)
      setStep('done')

      toast({
        title: 'Книга загружена!',
        description: `Создано ${uploadData.chaptersCreated} глав`,
      })

      // Redirect to book editor
      setTimeout(() => {
        router.push(`/admin/books/${book.id}`)
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
  }

  if (step === 'done') {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">Книга успешно загружена!</h2>
        <p className="text-muted-foreground">Перенаправляем в редактор...</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="-ml-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Загрузить книгу</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Создайте новую книгу и загрузите файл
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Book info card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Информация о книге</CardTitle>
            <CardDescription>Заполните основные данные</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Название *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Название книги..."
                disabled={step !== 'form'}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="book-slug"
                disabled={step !== 'form'}
                className="h-11 font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Краткое описание книги..."
                disabled={step !== 'form'}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Режим чтения по умолчанию</Label>
              <Select value={readingMode} onValueChange={setReadingMode} disabled={step !== 'form'}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feed">Лента (Feed)</SelectItem>
                  <SelectItem value="book">Книга (Book)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* File upload card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Файл книги</CardTitle>
            <CardDescription>Поддерживаются .docx, .md, .txt</CardDescription>
          </CardHeader>
          <CardContent>
            {file ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
                {getFileIcon(file.name)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} КБ
                  </p>
                </div>
                {step === 'form' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFile(null)}
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  dragActive
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50/50'
                )}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = ACCEPTED_EXTENSIONS.join(',')
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement
                    if (target.files?.[0]) handleFileSelect(target.files[0])
                  }
                  input.click()
                }}
              >
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-sm">
                  Перетащите файл сюда или нажмите для выбора
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  .docx, .md, .txt — до 50 МБ
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress */}
        {(creating || uploading) && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                {creating ? 'Создание книги...' : uploading ? 'Обработка файла...' : ''}
              </div>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {creating ? 'Подготовка к загрузке...' : `Загружено: ${Math.round(uploadProgress)}%`}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={!title || !slug || !file || step !== 'form'}
          className="w-full h-11 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-medium shadow-md"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Создание...
            </>
          ) : uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Загрузка...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Создать и загрузить
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
