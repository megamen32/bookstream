'use client'

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookCoverSection } from '@/components/admin/BookCoverSection'
import { BookMetadataSection } from '@/components/admin/BookMetadataSection'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  Loader2,
  MessageSquare,
  Plus,
  PanelLeft,
  PanelRight,
  Save,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { BookTextEditor } from '@/components/editor/BookTextEditor'
import type { EditorSaveStatus } from '@/components/editor/editor-types'
import { fetchAdmin } from '@/lib/admin-fetch'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const COVER_ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'] as const
const COVER_ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

interface Chapter {
  id: string
  title: string
  level: number
  position: number
  variants: ChapterVariant[]
}

interface ChapterVariant {
  id: string
  chapterId: string
  variantType: string
  contentHtml: string
  editedByAuthor: boolean
  headRevisionId?: string | null
}

interface VariantPreset {
  id: string
  slug: string
  label: string
  emoji: string
  description: string
  targetSizePercent: number | null
  position: number
}

interface VariantRevisionSummary {
  id: string
  revisionNumber: number
  source: string
  createdAt: string
}

interface BookData {
  id: string
  title: string
  slug: string
  description: string | null
  coverUrl: string | null
  openStatsPublic: boolean
  allowReaderVariantsAtOwnerExpense: boolean
  syntheticCommentsPerChapter: number
  syntheticQuotesPerChapter: number
  syntheticReactionsPerChapter: number
  syntheticCommentsUseLlm: boolean
  author: {
    slug: string
    name: string
  }
  isPublic: boolean
  readingModeDefault: string
  chapters: Chapter[]
  _count: { comments: number }
}

interface ChapterStatsSummary {
  chapterId: string
  title: string
  position: number
  uniqueReaders: number
  totalReadSeconds: number
  avgProgressPercent: number
  completionRatePercent: number
}

interface BookStatsResponse {
  book: {
    uniqueReaders: number
    totalReadSeconds: number
    avgReadSeconds: number
    avgProgressPercent: number
    completionRatePercent: number
  }
  chapters: ChapterStatsSummary[]
  topChapters: ChapterStatsSummary[]
}

interface AdminSettingsPayload {
  settings: {
    allowUserPublishing: boolean
  }
  reader: {
    isMainAdmin: boolean
  }
}

interface VariantTab {
  value: string
  label: string
  placeholder: string
}

type PendingEditorTransition =
  | { type: 'navigate'; href: string }
  | { type: 'chapter'; chapterId: string; variantType: string }
  | { type: 'variant'; variantType: string }

const DEFAULT_VARIANT_TABS: Array<VariantTab> = [
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

function buildVariantTabs(
  variantPresets: VariantPreset[],
  chapterVariants: ChapterVariant[],
): VariantTab[] {
  const tabs: VariantTab[] = [DEFAULT_VARIANT_TABS[0]]
  const knownVariantTypes = new Set<string>(['original'])

  if (variantPresets.length > 0) {
    for (const preset of variantPresets) {
      if (knownVariantTypes.has(preset.slug) || preset.slug === 'original') {
        continue
      }

      tabs.push({
        value: preset.slug,
        label: preset.label,
        placeholder: `Здесь будет версия «${preset.label}»…`,
      })
      knownVariantTypes.add(preset.slug)
    }
  } else {
    for (const defaultTab of DEFAULT_VARIANT_TABS.slice(1)) {
      tabs.push(defaultTab)
      knownVariantTypes.add(defaultTab.value)
    }
  }

  for (const chapterVariant of chapterVariants) {
    if (knownVariantTypes.has(chapterVariant.variantType)) {
      continue
    }

    tabs.push({
      value: chapterVariant.variantType,
      label: chapterVariant.variantType,
      placeholder: `Здесь будет версия «${chapterVariant.variantType}»…`,
    })
    knownVariantTypes.add(chapterVariant.variantType)
  }

  return tabs
}

function formatDurationLabel(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours} ч ${minutes} мин`
  }

  return `${minutes} мин`
}

export default function BookEditorPage() {
  const params = useParams()
  const router = useRouter()
  const bookId = params.bookId as string
  const { toast } = useToast()
  const adminFetch = useCallback(
    (input: RequestInfo | URL, options: RequestInit = {}) => fetchAdmin(input, router, options),
    [router],
  )

  const [book, setBook] = useState<BookData | null>(null)
  const [variantPresets, setVariantPresets] = useState<VariantPreset[]>([])
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
  const [chaptersPanelVisible, setChaptersPanelVisible] = useState(true)
  const [bookSettingsOpen, setBookSettingsOpen] = useState(false)
  const [initialChapterTitle, setInitialChapterTitle] = useState('')
  const [initialChapterContent, setInitialChapterContent] = useState('')
  const [revisionHistory, setRevisionHistory] = useState<VariantRevisionSummary[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(null)
  const [unsavedTransitionOpen, setUnsavedTransitionOpen] = useState(false)
  const [pendingTransition, setPendingTransition] = useState<PendingEditorTransition | null>(null)

  const [editTitle, setEditTitle] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(false)
  const [editReadingMode, setEditReadingMode] = useState('feed')
  const [savingBook, setSavingBook] = useState(false)
  const [activePrimaryTab, setActivePrimaryTab] = useState<'editor' | 'stats'>('editor')
  const [seedingEngagement, setSeedingEngagement] = useState(false)
  const [bookStats, setBookStats] = useState<BookStatsResponse | null>(null)
  const [loadingBookStats, setLoadingBookStats] = useState(true)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [savingCover, setSavingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const [editSyntheticCommentsPerChapter, setEditSyntheticCommentsPerChapter] = useState(3)
  const [editSyntheticQuotesPerChapter, setEditSyntheticQuotesPerChapter] = useState(1)
  const [editSyntheticReactionsPerChapter, setEditSyntheticReactionsPerChapter] = useState(5)
  const [editSyntheticCommentsUseLlm, setEditSyntheticCommentsUseLlm] = useState(false)
  const [editOpenStatsPublic, setEditOpenStatsPublic] = useState(false)
  const [editAllowReaderVariantsAtOwnerExpense, setEditAllowReaderVariantsAtOwnerExpense] = useState(false)
  const [allowUserPublishing, setAllowUserPublishing] = useState(true)
  const [isMainAdmin, setIsMainAdmin] = useState(false)
  const visibleRevisionHistory = selectedChapterId ? revisionHistory : []
  const visibleLoadingHistory = selectedChapterId ? loadingHistory : false

  useEffect(() => (
    () => {
      if (coverPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl)
      }
    }
  ), [coverPreviewUrl])

  const fetchBook = useCallback(async (): Promise<void> => {
    try {
      const res = await adminFetch(`/api/books/${bookId}?includeDrafts=1`)
      if (!res) {
        return
      }

      if (!res.ok) {
        if (res.status === 404) {
          toast({ title: 'Книга недоступна', variant: 'destructive' })
          router.replace('/admin')
          return
        }

        toast({ title: 'Не удалось загрузить книгу', variant: 'destructive' })
        return
      }

      const data = (await res.json()) as BookData
      const selectedExists = data.chapters.some((chapter) => chapter.id === selectedChapterId)

      setBook(data)
      setEditTitle(data.title)
      setEditSlug(data.slug)
      setEditDescription(data.description || '')
      setEditIsPublic(data.isPublic)
      setEditReadingMode(data.readingModeDefault)
      setEditSyntheticCommentsPerChapter(data.syntheticCommentsPerChapter)
      setEditSyntheticQuotesPerChapter(data.syntheticQuotesPerChapter)
      setEditSyntheticReactionsPerChapter(data.syntheticReactionsPerChapter)
      setEditSyntheticCommentsUseLlm(data.syntheticCommentsUseLlm)
      setEditOpenStatsPublic(data.openStatsPublic)
      setEditAllowReaderVariantsAtOwnerExpense(data.allowReaderVariantsAtOwnerExpense)
      setSelectedChapterId(selectedExists ? selectedChapterId : data.chapters[0]?.id ?? null)
    } catch (error) {
      console.error('Error fetching book:', error)
      toast({ title: 'Ошибка загрузки', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [adminFetch, bookId, router, selectedChapterId, toast])

  const fetchVariantPresets = useCallback(async (): Promise<void> => {
    try {
      const res = await adminFetch('/api/variant-presets')
      if (!res) {
        return
      }

      if (!res.ok) {
        return
      }

      const data = (await res.json()) as { presets?: VariantPreset[] }
      setVariantPresets(Array.isArray(data.presets) ? data.presets : [])
    } catch (error) {
      console.error('Error fetching variant presets:', error)
    }
  }, [adminFetch])

  const fetchBookStats = useCallback(async (): Promise<void> => {
    setLoadingBookStats(true)

    try {
      const response = await adminFetch(`/api/books/${bookId}/stats`)
      if (!response) {
        return
      }
      if (!response.ok) {
        setBookStats(null)
        return
      }

      const payload = (await response.json()) as BookStatsResponse
      setBookStats(payload)
    } catch (error) {
      console.error('Error fetching book stats:', error)
      setBookStats(null)
    } finally {
      setLoadingBookStats(false)
    }
  }, [adminFetch, bookId])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void fetchBook()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [fetchBook])

  useEffect(() => {
    if (!book) {
      return
    }

    void fetchBookStats()
  }, [book, fetchBookStats])

  useEffect(() => {
    let active = true

    async function loadAdminSettings(): Promise<void> {
      try {
        const response = await adminFetch('/api/admin/settings')
        if (!response) {
          return
        }
        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as AdminSettingsPayload
        if (!active) {
          return
        }

        setAllowUserPublishing(payload.settings.allowUserPublishing)
        setIsMainAdmin(payload.reader.isMainAdmin)
      } catch {
        // Settings are only needed to explain publishing restrictions in the UI.
      }
    }

    void loadAdminSettings()
    void fetchVariantPresets()

    return () => {
      active = false
    }
  }, [adminFetch, fetchVariantPresets])

  const selectedChapter = book?.chapters.find((chapter) => chapter.id === selectedChapterId)
  const currentVariant = selectedChapter?.variants.find(
    (variant) => variant.variantType === activeVariant
  )
  const visibleVariantTabs = buildVariantTabs(variantPresets, selectedChapter?.variants ?? [])
  const visibleVariantTypesKey = visibleVariantTabs.map((tab) => tab.value).join('|')
  const activeTab = visibleVariantTabs.find((tab) => tab.value === activeVariant)

  useEffect(() => {
    if (visibleVariantTabs.length === 0) {
      return
    }

    if (!visibleVariantTabs.some((tab) => tab.value === activeVariant)) {
      setActiveVariant(visibleVariantTabs[0]?.value ?? 'original')
    }
  }, [activeVariant, visibleVariantTypesKey])

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
  const chapterHasChanges =
    editChapterTitle !== initialChapterTitle || editContent !== initialChapterContent
  const hasUnsavedChapterChanges = chapterHasChanges && !saving
  const canPublishThisBook = isMainAdmin || allowUserPublishing
  const bookInfoHasChanges =
    book !== null &&
    (editTitle !== book.title ||
      editSlug !== book.slug ||
      editDescription !== (book.description || '') ||
      editIsPublic !== book.isPublic ||
      editReadingMode !== book.readingModeDefault ||
      editSyntheticCommentsPerChapter !== book.syntheticCommentsPerChapter ||
      editSyntheticQuotesPerChapter !== book.syntheticQuotesPerChapter ||
      editSyntheticReactionsPerChapter !== book.syntheticReactionsPerChapter ||
      editSyntheticCommentsUseLlm !== book.syntheticCommentsUseLlm ||
      editAllowReaderVariantsAtOwnerExpense !== book.allowReaderVariantsAtOwnerExpense ||
      editOpenStatsPublic !== book.openStatsPublic)
  const effectiveCoverPreview = coverPreviewUrl || book?.coverUrl || null

  const clampSyntheticCount = useCallback((value: number): number => {
    if (!Number.isFinite(value)) {
      return 0
    }

    return Math.max(0, Math.min(20, Math.round(value)))
  }, [])

  const handleSyntheticCountChange = useCallback(
    (
      nextValue: string,
      setter: (value: number) => void,
    ): void => {
      const parsed = Number(nextValue)
      setter(Number.isFinite(parsed) ? clampSyntheticCount(parsed) : 0)
    },
    [clampSyntheticCount],
  )

  const handleEditorChange = (html: string): void => {
    setEditContent(html)
    setSaveStatus(editChapterTitle !== initialChapterTitle || html !== initialChapterContent ? 'dirty' : 'idle')
  }

  const handleChapterTitleChange = (title: string): void => {
    setEditChapterTitle(title)
    setSaveStatus(title !== initialChapterTitle || editContent !== initialChapterContent ? 'dirty' : 'idle')
  }

  const handleSaveChapter = async (): Promise<boolean> => {
    if (!selectedChapterId) {
      return false
    }

    setSaving(true)
    setSaveStatus('saving')

    try {
      if (!editChapterTitle.trim()) {
        throw new Error('Название главы не может быть пустым')
      }

      const chapterRes = await adminFetch(`/api/chapters/${selectedChapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editChapterTitle }),
      })

      if (!chapterRes) {
        return false
      }

      if (!chapterRes.ok) {
        const payload = await chapterRes.json()
        throw new Error(payload.error || 'Не удалось сохранить название главы')
      }

      const variantRes = await adminFetch(
        `/api/chapters/${selectedChapterId}/variants/${activeVariant}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentHtml: editContent }),
        }
      )

      if (!variantRes) {
        return false
      }

      if (!variantRes.ok) {
        const payload = await variantRes.json()
        throw new Error(payload.error || 'Не удалось сохранить вариант главы')
      }

      // Keep the local baseline aligned with the saved state before any
      // follow-up transition runs.
      setInitialChapterTitle(editChapterTitle)
      setInitialChapterContent(editContent)
      setSaveStatus('saved')
      toast({ title: 'Сохранено', description: 'Название и текст главы обновлены' })
      void fetchBook()
      return true
    } catch (error) {
      setSaveStatus('error')
      toast({
        title: 'Ошибка сохранения',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const executeTransition = useCallback((transition: PendingEditorTransition): void => {
    if (transition.type === 'navigate') {
      router.push(transition.href)
      return
    }

    if (transition.type === 'chapter') {
      setActiveVariant(transition.variantType)
      setSelectedChapterId(transition.chapterId)
      return
    }

    setActiveVariant(transition.variantType)
  }, [router])

  const requestTransition = useCallback((transition: PendingEditorTransition): void => {
    if (hasUnsavedChapterChanges) {
      setPendingTransition(transition)
      setUnsavedTransitionOpen(true)
      return
    }

    executeTransition(transition)
  }, [executeTransition, hasUnsavedChapterChanges])

  const handleDiscardAndContinue = useCallback((): void => {
    if (!pendingTransition) {
      return
    }

    const transition = pendingTransition
    setPendingTransition(null)
    setUnsavedTransitionOpen(false)
    executeTransition(transition)
  }, [executeTransition, pendingTransition])

  const handleSaveAndContinue = useCallback(async (): Promise<void> => {
    if (!pendingTransition) {
      return
    }

    const saved = await handleSaveChapter()
    if (!saved) {
      return
    }

    const transition = pendingTransition
    setPendingTransition(null)
    setUnsavedTransitionOpen(false)
    executeTransition(transition)
  }, [executeTransition, handleSaveChapter, pendingTransition])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!hasUnsavedChapterChanges) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChapterChanges])

  useEffect(() => {
    if (!selectedChapterId) {
      return
    }

    let cancelled = false
    void (async () => {
      setLoadingHistory(true)

      try {
        const response = await adminFetch(`/api/chapters/${selectedChapterId}/variants/${activeVariant}/history`)
        if (!response) {
          return
        }

        if (!response.ok) {
          throw new Error('history fetch failed')
        }

        const payload = (await response.json()) as { revisions?: VariantRevisionSummary[] }

        if (!cancelled) {
          setRevisionHistory(payload.revisions || [])
        }
      } catch {
        if (!cancelled) {
          setRevisionHistory([])
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeVariant, adminFetch, selectedChapterId])

  const handleRestoreRevision = async (revisionId: string): Promise<void> => {
    if (!selectedChapterId) {
      return
    }

    setRestoringRevisionId(revisionId)

    try {
      const response = await adminFetch(
        `/api/chapters/${selectedChapterId}/variants/${activeVariant}/history/${revisionId}`,
        {
          method: 'POST',
        },
      )

      if (!response) {
        return
      }

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error || 'Не удалось восстановить ревизию')
      }

      toast({
        title: 'Версия восстановлена',
        description: 'Создана новая head revision на основе выбранного снимка',
      })
      await fetchBook()
    } catch (error) {
      toast({
        title: 'Ошибка восстановления',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setRestoringRevisionId(null)
    }
  }

  const handleGenerateAI = async (): Promise<void> => {
    if (!selectedChapterId) {
      return
    }

    const generateAllVariants = activeVariant === 'original'
    setGenerating(true)

    try {
      const payload = generateAllVariants
        ? {}
        : { variantType: activeVariant }

      const res = await adminFetch(`/api/chapters/${selectedChapterId}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res) {
        return
      }

      if (!res.ok) {
        throw new Error('AI generation failed')
      }

      toast({ title: 'Готово', description: 'Варианты сгенерированы' })
      await fetchBook()
      setActiveVariant(
        generateAllVariants
          ? visibleVariantTabs.find((tab) => tab.value !== 'original')?.value ?? 'original'
          : activeVariant,
      )
    } catch {
      toast({ title: 'Ошибка генерации', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveBook = useCallback(async (): Promise<void> => {
    setSavingBook(true)

    try {
      const res = await adminFetch(`/api/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          slug: editSlug,
          isPublic: editIsPublic,
          readingModeDefault: editReadingMode,
          syntheticCommentsPerChapter: clampSyntheticCount(editSyntheticCommentsPerChapter),
          syntheticQuotesPerChapter: clampSyntheticCount(editSyntheticQuotesPerChapter),
          syntheticReactionsPerChapter: clampSyntheticCount(editSyntheticReactionsPerChapter),
          syntheticCommentsUseLlm: editSyntheticCommentsUseLlm,
          allowReaderVariantsAtOwnerExpense: editAllowReaderVariantsAtOwnerExpense,
          openStatsPublic: editOpenStatsPublic,
        }),
      })

      if (!res) {
        return
      }

      if (!res.ok) {
        throw new Error('Book save failed')
      }

      toast({ title: 'Сохранено', description: 'Информация о книге обновлена' })
      setBookSettingsOpen(false)
      void fetchBook()
    } catch {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' })
    } finally {
      setSavingBook(false)
    }
  }, [adminFetch, bookId, clampSyntheticCount, editAllowReaderVariantsAtOwnerExpense, editDescription, editIsPublic, editOpenStatsPublic, editReadingMode, editSlug, editSyntheticCommentsPerChapter, editSyntheticCommentsUseLlm, editSyntheticQuotesPerChapter, editSyntheticReactionsPerChapter, editTitle, fetchBook, toast])

  const handleSeedSyntheticEngagement = useCallback(async (): Promise<void> => {
    setSeedingEngagement(true)

    try {
      const response = await adminFetch(`/api/books/${bookId}/synthetic-engagement`, {
        method: 'POST',
      })

      if (!response) {
        return
      }

      const payload = (await response.json()) as {
        error?: string
        generated?: {
          comments: number
          quotes: number
          reactions: number
        }
      }

      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось заселить главы активностью')
      }

      toast({
        title: 'Синтетическая активность добавлена',
        description: `Комментарии: ${payload.generated?.comments ?? 0} · Цитаты: ${payload.generated?.quotes ?? 0} · Реакции: ${payload.generated?.reactions ?? 0}`,
      })
      await fetchBook()
      await fetchBookStats()
    } catch (error) {
      toast({
        title: 'Ошибка генерации активности',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSeedingEngagement(false)
    }
  }, [adminFetch, bookId, fetchBook, fetchBookStats, toast])

  const replaceCoverPreview = useCallback((nextPreviewUrl: string | null): void => {
    setCoverPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(currentPreviewUrl)
      }

      return nextPreviewUrl
    })
  }, [])

  const getFileExtension = useCallback((fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    return extension ? `.${extension}` : ''
  }, [])

  const isAcceptedCoverFile = useCallback((file: File): boolean => {
    if (COVER_ACCEPTED_MIME_TYPES.includes(file.type as typeof COVER_ACCEPTED_MIME_TYPES[number])) {
      return true
    }

    return COVER_ACCEPTED_EXTENSIONS.includes(
      getFileExtension(file.name) as typeof COVER_ACCEPTED_EXTENSIONS[number]
    )
  }, [getFileExtension])

  const handleCoverFileChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const selectedCoverFile = event.target.files?.[0]
    event.currentTarget.value = ''

    if (!selectedCoverFile) {
      return
    }

    if (!isAcceptedCoverFile(selectedCoverFile)) {
      toast({
        title: 'Неподдерживаемая обложка',
        description: 'Выберите изображение в формате JPG, PNG, WEBP или AVIF',
        variant: 'destructive',
      })
      return
    }

    setCoverFile(selectedCoverFile)
    replaceCoverPreview(URL.createObjectURL(selectedCoverFile))
  }, [isAcceptedCoverFile, replaceCoverPreview, toast])

  const clearPendingCover = useCallback((): void => {
    setCoverFile(null)
    replaceCoverPreview(null)
  }, [replaceCoverPreview])

  const handleSaveCover = useCallback(async (): Promise<void> => {
    if (!book || !coverFile) {
      return
    }

    setSavingCover(true)

    try {
      const formData = new FormData()
      formData.append('cover', coverFile)

      const response = await adminFetch(`/api/books/${book.id}/cover`, {
        method: 'PUT',
        body: formData,
      })

      if (!response) {
        return
      }

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error || 'Не удалось обновить обложку')
      }

      const payload = (await response.json()) as { coverUrl: string }

      clearPendingCover()
      setBook((currentBook) => (
        currentBook
          ? {
              ...currentBook,
              coverUrl: payload.coverUrl,
            }
          : currentBook
      ))
      toast({ title: 'Сохранено', description: 'Обложка книги обновлена' })
    } catch (error) {
      toast({
        title: 'Ошибка сохранения обложки',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSavingCover(false)
    }
  }, [adminFetch, book, clearPendingCover, coverFile, toast])

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
      const res = await adminFetch(`/api/books/${bookId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Новая глава ${book.chapters.length + 1}`,
        }),
      })

      if (!res) {
        return
      }

      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Не удалось создать главу')
      }

      const chapter = (await res.json()) as Chapter

      setActiveVariant('original')
      await fetchBook()
      await fetchBookStats()
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
      const res = await adminFetch(`/api/chapters/${selectedChapterId}`, {
        method: 'DELETE',
      })

      if (!res) {
        return
      }

      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Не удалось удалить главу')
      }

      setDeleteDialogOpen(false)
      setActiveVariant('original')
      await fetchBook()
      await fetchBookStats()
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
      <input
        ref={coverInputRef}
        type="file"
        accept={COVER_ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        onChange={handleCoverFileChange}
      />

      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 rounded-full"
            onClick={(event) => {
              if (!hasUnsavedChapterChanges) {
                return
              }

              event.preventDefault()
              requestTransition({ type: 'navigate', href: '/admin' })
            }}
          >
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
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge
              variant={book.isPublic ? 'default' : 'secondary'}
              className="rounded-full"
            >
              {book.isPublic ? 'Публичная' : 'Черновик'}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {book.readingModeDefault === 'book' ? 'Режим: книга' : 'Режим: лента'}
            </Badge>
            {book.coverUrl ? (
              <Badge variant="outline" className="rounded-full">
                Обложка прикреплена
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Sheet open={bookSettingsOpen} onOpenChange={setBookSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                <Settings2 className="mr-2 h-4 w-4" />
                Настройки
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Настройки книги</SheetTitle>
                <SheetDescription>
                  Те же секции, что и в upload flow: проверка обложки и правка основных метаданных.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-4">
                <BookCoverSection
                  description="Можно заменить обложку прямо здесь. После выбора файла сначала проверьте превью, потом сохраните."
                  previewUrl={effectiveCoverPreview}
                  emptyTitle="Обложка не прикреплена"
                  emptyDescription="Выберите изображение, чтобы прикрепить новую обложку к книге."
                  actions={(
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={savingBook || savingCover}
                      >
                        {coverFile ? 'Заменить обложку' : 'Выбрать обложку'}
                      </Button>

                      {coverFile ? (
                        <>
                          <Button
                            type="button"
                            onClick={() => {
                              void handleSaveCover()
                            }}
                            disabled={savingCover}
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            {savingCover ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            Сохранить обложку
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            onClick={clearPendingCover}
                            disabled={savingCover}
                          >
                            Отменить замену
                          </Button>
                        </>
                      ) : null}
                    </>
                  )}
                  helperText={
                    coverFile
                      ? `Выбрана новая обложка: ${coverFile.name}`
                      : 'Файл сохраняется отдельно от метаданных книги.'
                  }
                />

                <BookMetadataSection
                  description="Изменения сохраняются в карточках книги и публичной странице."
                  idPrefix="book-settings"
                  titleValue={editTitle}
                  onTitleChange={setEditTitle}
                  slugValue={editSlug}
                  onSlugChange={setEditSlug}
                  descriptionValue={editDescription}
                  onDescriptionChange={setEditDescription}
                  readingMode={editReadingMode}
                  onReadingModeChange={setEditReadingMode}
                  isPublic={editIsPublic}
                  onIsPublicChange={setEditIsPublic}
                  showVisibility
                  visibilityNote={
                    canPublishThisBook
                      ? 'Можно переключать между черновиком и публичной книгой.'
                      : 'Главный админ отключил публикацию для обычных пользователей. Эта книга останется приватной и будет видна только вам.'
                  }
                  beforeFields={(
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                      <Label htmlFor="book-open-stats" className="items-start gap-3">
                        <Checkbox
                          id="book-open-stats"
                          checked={editOpenStatsPublic}
                          onCheckedChange={(checked) => setEditOpenStatsPublic(checked === true)}
                          disabled={savingBook}
                          className="mt-0.5"
                        />
                        <span className="space-y-1">
                          <span className="block text-sm font-medium">
                            Открытая статистика
                          </span>
                          <span className="block text-sm text-muted-foreground">
                            Показывать читателям агрегаты по книге: популярность, среднее время чтения и прогресс.
                          </span>
                        </span>
                      </Label>
                    </div>
                  )}
                  disabled={savingBook || !canPublishThisBook}
                />

                <Card className="border-border/60">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-base">Варианты для читателей</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Для публичной книги недостающие варианты могут создаваться лениво по запросу читателя.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Label htmlFor="book-owner-sponsored-variants" className="items-start gap-3">
                      <Checkbox
                        id="book-owner-sponsored-variants"
                        checked={editAllowReaderVariantsAtOwnerExpense}
                        onCheckedChange={(checked) => setEditAllowReaderVariantsAtOwnerExpense(checked === true)}
                        disabled={savingBook}
                        className="mt-0.5"
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-medium">
                          Генерировать варианты читателям за счёт владельца
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          Если выключено, читателю будет предложено использовать свои LLM-настройки. Если включено,
                          генерация идёт через LLM владельца книги.
                        </span>
                      </span>
                    </Label>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-base">Синтетическая активность</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Нужна для пустого старта: автор может заранее “заселить” книгу комментариями,
                      цитатами и реакциями. Эти записи помечаются как синтетические и потом могут
                      скрываться отдельно от реальных.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Комментарии / глава</span>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          value={editSyntheticCommentsPerChapter}
                          onChange={(event) => {
                            handleSyntheticCountChange(event.target.value, setEditSyntheticCommentsPerChapter)
                          }}
                          disabled={savingBook || seedingEngagement}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">Цитаты / глава</span>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          value={editSyntheticQuotesPerChapter}
                          onChange={(event) => {
                            handleSyntheticCountChange(event.target.value, setEditSyntheticQuotesPerChapter)
                          }}
                          disabled={savingBook || seedingEngagement}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">Реакции / глава</span>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          value={editSyntheticReactionsPerChapter}
                          onChange={(event) => {
                            handleSyntheticCountChange(event.target.value, setEditSyntheticReactionsPerChapter)
                          }}
                          disabled={savingBook || seedingEngagement}
                        />
                      </label>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                      <Label htmlFor="synthetic-comments-use-llm" className="items-start gap-3">
                        <Checkbox
                          id="synthetic-comments-use-llm"
                          checked={editSyntheticCommentsUseLlm}
                          onCheckedChange={(checked) => setEditSyntheticCommentsUseLlm(checked === true)}
                          disabled={savingBook || seedingEngagement}
                          className="mt-0.5"
                        />
                        <span className="space-y-1">
                          <span className="block text-sm font-medium">
                            Использовать LLM для синтетических комментариев
                          </span>
                          <span className="block text-sm text-muted-foreground">
                            Цитаты и диапазоны всё равно остаются привязанными к реальному тексту главы,
                            а `LLM` меняет формулировки комментариев и может подсказать эмодзи для реакций.
                            Если `LLM_*` переменные не настроены, генератор вернёт ошибку.
                          </span>
                        </span>
                      </Label>
                    </div>

                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4">
                      <p className="text-sm text-muted-foreground">
                        Генератор проходит по всем главам и дозаполняет только недостающий минимум.
                        Уже созданные синтетические записи повторно не дублируются.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4 rounded-full"
                        disabled={savingBook || seedingEngagement || bookInfoHasChanges}
                        onClick={() => {
                          void handleSeedSyntheticEngagement()
                        }}
                      >
                        {seedingEngagement ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Сгенерировать активность по всем главам
                      </Button>
                      {bookInfoHasChanges ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Сначала сохраните настройки книги, чтобы генератор использовал актуальные минимумы.
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <SheetFooter className="border-t bg-background/95">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBookSettingsOpen(false)}
                  disabled={savingBook || seedingEngagement}
                >
                  Закрыть
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void handleSaveBook()
                  }}
                  disabled={savingBook || seedingEngagement || !bookInfoHasChanges}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {savingBook ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Сохранить
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Link href={`/admin/books/${bookId}/comments`}>
            <Button
              variant="outline"
              size="sm"
              className="hidden rounded-full sm:flex"
              onClick={(event) => {
                if (!hasUnsavedChapterChanges) {
                  return
                }

                event.preventDefault()
                requestTransition({ type: 'navigate', href: `/admin/books/${bookId}/comments` })
              }}
            >
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
      </div>

      <div
        className={cn(
          'grid gap-6',
          activePrimaryTab === 'editor' && chaptersPanelVisible ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-1'
        )}
      >
        <div className="lg:col-span-full">
          <Tabs
            value={activePrimaryTab}
            onValueChange={(value) => {
              if (value === 'editor' || value === 'stats') {
                setActivePrimaryTab(value)
                if (value === 'stats') {
                  void fetchBookStats()
                }
              }
            }}
          >
            <TabsList className="rounded-full">
              <TabsTrigger value="editor" className="rounded-full">
                <BookOpen className="mr-2 h-4 w-4" />
                Редактор
              </TabsTrigger>
              <TabsTrigger value="stats" className="rounded-full">
                <BarChart3 className="mr-2 h-4 w-4" />
                Статистика
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <main className="min-w-0 space-y-4">
          {activePrimaryTab === 'stats' ? (
            <Card className="rounded-3xl border-border/70 bg-card/70 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Статистика чтения</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Статистика собирается по реальным открытиям reader и heartbeat-событиям во время активного чтения.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      void fetchBookStats()
                    }}
                    disabled={loadingBookStats}
                  >
                    {loadingBookStats ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <BarChart3 className="mr-2 h-4 w-4" />
                    )}
                    Обновить
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                    <div className="text-3xl font-semibold">{bookStats?.book.uniqueReaders ?? 0}</div>
                    <div className="mt-2 text-sm text-muted-foreground">уникальных читателей</div>
                  </div>
                  <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                    <div className="text-3xl font-semibold">
                      {formatDurationLabel(bookStats?.book.totalReadSeconds ?? 0)}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">суммарное время чтения</div>
                  </div>
                  <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                    <div className="text-3xl font-semibold">
                      {formatDurationLabel(bookStats?.book.avgReadSeconds ?? 0)}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">среднее время на читателя</div>
                  </div>
                  <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                    <div className="text-3xl font-semibold">{bookStats?.book.avgProgressPercent ?? 0}%</div>
                    <div className="mt-2 text-sm text-muted-foreground">средний прогресс</div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">Главы</div>
                        <div className="text-xs text-muted-foreground">
                          Читаемость, время и дочитывания по каждой главе.
                        </div>
                      </div>
                      {loadingBookStats ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    </div>

                    <div className="space-y-3">
                      {bookStats?.chapters.map((chapterStat) => (
                        <div
                          key={chapterStat.chapterId}
                          className="grid gap-3 rounded-2xl border border-border/50 bg-background/60 p-4 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.7fr))]"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              Глава {chapterStat.position + 1}
                            </div>
                            <div className="mt-1 truncate text-sm text-muted-foreground">
                              {chapterStat.title}
                            </div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold">{chapterStat.uniqueReaders}</div>
                            <div className="text-xs text-muted-foreground">читателей</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold">
                              {formatDurationLabel(chapterStat.totalReadSeconds)}
                            </div>
                            <div className="text-xs text-muted-foreground">время</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold">{chapterStat.avgProgressPercent}%</div>
                            <div className="text-xs text-muted-foreground">прогресс</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold">{chapterStat.completionRatePercent}%</div>
                            <div className="text-xs text-muted-foreground">дочитывают</div>
                          </div>
                        </div>
                      ))}

                      {!loadingBookStats && (bookStats?.chapters.length ?? 0) === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                          Пока нет данных о чтении этой книги.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                    <div className="text-sm font-medium">Топ глав</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Список строится по уникальным читателям.
                    </div>
                    <div className="mt-4 space-y-3">
                      {bookStats?.topChapters.map((chapterStat) => (
                        <div
                          key={`top-${chapterStat.chapterId}`}
                          className="rounded-2xl border border-border/50 bg-background/60 p-4"
                        >
                          <div className="text-sm font-medium">
                            Глава {chapterStat.position + 1}
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {chapterStat.title}
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{chapterStat.uniqueReaders} читателей</span>
                            <span>{chapterStat.completionRatePercent}% дочитывают</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : selectedChapter ? (
            <Card className="rounded-3xl border-border/70 bg-card/70 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">Глава {selectedChapter.position + 1}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Название редактируется в поле ниже · Telegraph-like редактор · сохраняется как HTML
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
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <Tabs
                  value={activeVariant}
                  onValueChange={(value) => {
                    if (value === activeVariant) {
                      return
                    }

                    requestTransition({ type: 'variant', variantType: value })
                  }}
                >
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <TabsList className="flex min-w-0 flex-1 flex-wrap rounded-full">
                      {visibleVariantTabs.map((tab) => {
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

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setGenerateDialogOpen(true)
                      }}
                      disabled={generating}
                      className="shrink-0 rounded-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      {generating ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3" />
                      )}
                      {activeVariant === 'original'
                        ? 'Сгенерировать AI все варианты'
                        : `ИИ генерировать ${activeTab?.label || activeVariant}`}
                    </Button>
                  </div>

                  {visibleVariantTabs.map((tab) => (
                    <TabsContent key={tab.value} value={tab.value} className="mt-0">
                      <BookTextEditor
                        value={activeVariant === tab.value ? editContent : ''}
                        title={editChapterTitle}
                        onChange={handleEditorChange}
                        onTitleChange={handleChapterTitleChange}
                        titlePlaceholder="Название главы"
                        placeholder={activeTab?.placeholder || tab.placeholder}
                        onSave={async () => {
                          await handleSaveChapter()
                        }}
                        saving={saving}
                        saveStatus={saveStatus}
                        saveDisabled={!chapterHasChanges}
                      />
                    </TabsContent>
                  ))}
                </Tabs>

                <div className="mt-6 rounded-3xl border border-border/60 bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">История версии</div>
                      <div className="text-xs text-muted-foreground">
                        Ревизии для текущего варианта главы
                      </div>
                    </div>
                    {visibleLoadingHistory && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>

                  <div className="space-y-2">
                    {visibleRevisionHistory.slice(0, 8).map((revision) => (
                      <div
                        key={revision.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-background/60 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            Rev {revision.revisionNumber}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {revision.source} · {new Date(revision.createdAt).toLocaleString('ru-RU')}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          disabled={restoringRevisionId === revision.id}
                          onClick={() => {
                            void handleRestoreRevision(revision.id)
                          }}
                        >
                          {restoringRevisionId === revision.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Restore'
                          )}
                        </Button>
                      </div>
                    ))}

                    {!visibleLoadingHistory && visibleRevisionHistory.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                        История появится после первого сохранения этого варианта.
                      </div>
                    )}
                  </div>
                </div>
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
            activePrimaryTab === 'editor' && chaptersPanelVisible ? 'block' : 'hidden',
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
              <ScrollArea className="h-[min(70vh,calc(100vh-16rem))] pr-2">
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

                        requestTransition({
                          type: 'chapter',
                          chapterId: chapter.id,
                          variantType: nextVariant,
                        })
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 overflow-hidden rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                        selectedChapterId === chapter.id
                          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                      style={{
                        paddingInlineStart: `${0.75 + Math.max(0, chapter.level - 1) * 1.25}rem`,
                      }}
                    >
                      <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                        {chapter.position + 1}.
                      </span>
                      <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                      {chapter.level > 1 && (
                        <Badge
                          variant="outline"
                          className="rounded-full px-1.5 py-0 text-[10px]"
                        >
                          L{chapter.level}
                        </Badge>
                      )}
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
              {activeVariant === 'original'
                ? 'Сгенерировать все варианты?'
                : 'Сгенерировать только эту версию?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {activeVariant === 'original'
                  ? 'Будут обновлены все варианты из шаблонов.'
                  : <>Будет обновлена только версия <strong>{activeTab?.label || activeVariant}</strong>.</>}
              </span>
              {activeVariant !== 'original' && currentVariant?.editedByAuthor && (
                <span className="block text-destructive">
                  Сейчас в этой версии есть авторские правки. Генерация перезапишет их.
                </span>
              )}
              {activeVariant === 'original' && selectedChapter?.variants.some(
                (variant) => variant.variantType !== 'original' && variant.editedByAuthor
              ) && (
                <span className="block text-destructive">
                  В некоторых вариантах уже есть авторские правки. Генерация перезапишет их.
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

      <AlertDialog
        open={unsavedTransitionOpen}
        onOpenChange={(open) => {
          if (!open && saving) {
            return
          }

          setUnsavedTransitionOpen(open)
          if (!open) {
            setPendingTransition(null)
          }
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Есть несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingTransition?.type === 'navigate'
                ? 'Если вы уйдёте со страницы сейчас, последние правки в главе будут потеряны.'
                : 'Если вы переключите главу или версию сейчас, текущие правки будут потеряны.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-full"
              disabled={saving}
              onClick={() => setPendingTransition(null)}
            >
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                handleDiscardAndContinue()
              }}
              className="rounded-full"
              disabled={saving}
            >
              Не сохранять
            </AlertDialogAction>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleSaveAndContinue()
              }}
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={saving}
            >
              {pendingTransition?.type === 'navigate' ? 'Сохранить и выйти' : 'Сохранить и продолжить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-4 sm:hidden">
        <Link href={`/admin/books/${bookId}/comments`} className="block">
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={(event) => {
              if (!hasUnsavedChapterChanges) {
                return
              }

              event.preventDefault()
              requestTransition({ type: 'navigate', href: `/admin/books/${bookId}/comments` })
            }}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Комментарии ({book._count.comments})
          </Button>
        </Link>
      </div>
    </div>
  )
}
