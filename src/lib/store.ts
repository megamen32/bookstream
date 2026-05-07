import type { StoreApi, UseBoundStore } from 'zustand'
import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export type VariantType = string
export type ReadingMode = 'feed' | 'book'
export type LineWidth = 'narrow' | 'medium' | 'wide'
export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'oled'
export type AccentTheme = 'sky' | 'forest' | 'sunset'

export interface ReplyQuote {
  text: string
  variantType: string
  paragraphId: string
  endParagraphId?: string | null
  startOffset?: number
  endOffset?: number
  selectedText?: string
}

interface ReaderState {
  // Current reading context
  bookId: string | null
  chapterId: string | null
  variantType: VariantType
  readingMode: ReadingMode
  hasStoredReadingMode: boolean

  // UI Settings
  fontSize: number
  lineHeight: number
  lineWidth: LineWidth
  theme: ReaderTheme
  accentTheme: AccentTheme
  showMobileReactionBar: boolean

  // Reader identity
  readerId: string
  username: string
  showCommunityAnnotations: boolean

  // Comment composer
  replyingTo: ReplyQuote | null

  // Actions
  setBookId: (id: string) => void
  setChapterId: (id: string) => void
  setVariantType: (type: VariantType) => void
  setReadingMode: (mode: ReadingMode) => void
  setFontSize: (size: number) => void
  setLineHeight: (height: number) => void
  setLineWidth: (width: LineWidth) => void
  setTheme: (theme: ReaderTheme) => void
  setAccentTheme: (theme: AccentTheme) => void
  setShowMobileReactionBar: (show: boolean) => void
  setReaderId: (id: string) => void
  setUsername: (name: string) => void
  setShowCommunityAnnotations: (value: boolean) => void
  setReplyingTo: (quote: ReplyQuote | null) => void

  // Persistence
  loadFromStorage: () => void
  saveToStorage: () => void
}

function generateRussianUsername(): string {
  const num = Math.floor(Math.random() * 999) + 1
  return `читатель-${num}`
}

function generateReaderId(): string {
  return uuidv4()
}

const STORAGE_KEY = 'bookstream-reader-state'

type ReaderStore = UseBoundStore<StoreApi<ReaderState>>

declare global {
  interface Window {
    __bookstreamReaderStore?: ReaderStore
  }
}

interface StoredState {
  readerId?: string
  username?: string
  showCommunityAnnotations?: boolean
  accentTheme?: AccentTheme
  fontSize?: number
  lineHeight?: number
  lineWidth?: LineWidth
  theme?: ReaderTheme
  readingMode?: ReadingMode
  showMobileReactionBar?: boolean
}

function createReaderStore(): ReaderStore {
  return create<ReaderState>((set, get) => ({
    // Current reading context
    bookId: null,
    chapterId: null,
    variantType: 'original',
    readingMode: 'feed',
    hasStoredReadingMode: false,

    // UI Settings
    fontSize: 18,
    lineHeight: 1.6,
    lineWidth: 'medium',
    theme: 'light',
    accentTheme: 'sky',
    showMobileReactionBar: false,

    // Reader identity
    readerId: '',
    username: '',
    showCommunityAnnotations: true,

    // Comment composer
    replyingTo: null,

    // Actions
    setBookId: (id: string) => set({ bookId: id }),
    setChapterId: (id: string) => set({ chapterId: id }),
    setVariantType: (type: VariantType) => set({ variantType: type }),
    setReadingMode: (mode: ReadingMode) => {
      set({ readingMode: mode, hasStoredReadingMode: true })
      get().saveToStorage()
    },
    setFontSize: (size: number) => {
      set({ fontSize: size })
      get().saveToStorage()
    },
    setLineHeight: (height: number) => {
      set({ lineHeight: height })
      get().saveToStorage()
    },
    setLineWidth: (width: LineWidth) => {
      set({ lineWidth: width })
      get().saveToStorage()
    },
    setTheme: (theme: ReaderTheme) => {
      set({ theme: theme })
      get().saveToStorage()
    },
    setAccentTheme: (accentTheme: AccentTheme) => {
      set({ accentTheme })
      get().saveToStorage()
    },
    setShowMobileReactionBar: (showMobileReactionBar: boolean) => {
      set({ showMobileReactionBar })
      get().saveToStorage()
    },
    setReaderId: (id: string) => {
      set({ readerId: id })
      get().saveToStorage()
    },
    setUsername: (name: string) => {
      set({ username: name })
      get().saveToStorage()
    },
    setShowCommunityAnnotations: (value: boolean) => {
      set({ showCommunityAnnotations: value })
      get().saveToStorage()
    },
    setReplyingTo: (quote: ReplyQuote | null) => set({ replyingTo: quote }),

    // Persistence
    loadFromStorage: () => {
      if (typeof window === 'undefined') return
      const currentState = get()
      if (currentState.readerId) return

      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
          const readerId = generateReaderId()
          const username = generateRussianUsername()
          set({ readerId, username })
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ readerId, username, accentTheme: 'sky' }))
          return
        }
        const stored: StoredState = JSON.parse(raw)
        set({
          readerId: stored.readerId || generateReaderId(),
          username: stored.username || generateRussianUsername(),
          showCommunityAnnotations: stored.showCommunityAnnotations ?? true,
          accentTheme: stored.accentTheme || 'sky',
          fontSize: stored.fontSize || 18,
          lineHeight: stored.lineHeight || 1.6,
          lineWidth: stored.lineWidth || 'medium',
          theme: stored.theme || 'light',
          readingMode: stored.readingMode || 'feed',
          hasStoredReadingMode: stored.readingMode !== undefined,
          showMobileReactionBar: stored.showMobileReactionBar || false,
        })
      } catch {
        const readerId = generateReaderId()
        const username = generateRussianUsername()
        set({ readerId, username, hasStoredReadingMode: false })
      }
    },

    saveToStorage: () => {
      if (typeof window === 'undefined') return
      try {
        const state = get()
        const toStore: StoredState = {
          readerId: state.readerId,
          username: state.username,
          showCommunityAnnotations: state.showCommunityAnnotations,
          accentTheme: state.accentTheme,
          fontSize: state.fontSize,
          lineHeight: state.lineHeight,
          lineWidth: state.lineWidth,
          theme: state.theme,
          readingMode: state.readingMode,
          showMobileReactionBar: state.showMobileReactionBar,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
      } catch {
        // silently fail
      }
    },
  }))
}

const existingReaderStore = typeof window !== 'undefined' ? window.__bookstreamReaderStore : undefined
const readerStore = existingReaderStore ?? createReaderStore()

if (typeof window !== 'undefined') {
  window.__bookstreamReaderStore = readerStore
}

export const useReaderStore = readerStore
