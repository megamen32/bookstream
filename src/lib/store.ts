import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export type VariantType = 'original' | 'clean' | 'essence'
export type ReadingMode = 'feed' | 'book'
export type LineWidth = 'narrow' | 'medium' | 'wide'
export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'oled'

interface ReplyQuote {
  text: string
  variantType: string
  paragraphId: string
}

interface ReaderState {
  // Current reading context
  bookId: string | null
  chapterId: string | null
  variantType: VariantType
  readingMode: ReadingMode

  // UI Settings
  fontSize: number
  lineHeight: number
  lineWidth: LineWidth
  theme: ReaderTheme

  // Reader identity
  readerId: string
  username: string

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
  setReaderId: (id: string) => void
  setUsername: (name: string) => void
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

interface StoredState {
  readerId?: string
  username?: string
  fontSize?: number
  lineHeight?: number
  lineWidth?: LineWidth
  theme?: ReaderTheme
  readingMode?: ReadingMode
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  // Current reading context
  bookId: null,
  chapterId: null,
  variantType: 'original',
  readingMode: 'feed',

  // UI Settings
  fontSize: 18,
  lineHeight: 1.6,
  lineWidth: 'medium',
  theme: 'light',

  // Reader identity
  readerId: '',
  username: '',

  // Comment composer
  replyingTo: null,

  // Actions
  setBookId: (id: string) => set({ bookId: id }),
  setChapterId: (id: string) => set({ chapterId: id }),
  setVariantType: (type: VariantType) => set({ variantType: type }),
  setReadingMode: (mode: ReadingMode) => set({ readingMode: mode }),
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
  setReaderId: (id: string) => {
    set({ readerId: id })
    get().saveToStorage()
  },
  setUsername: (name: string) => {
    set({ username: name })
    get().saveToStorage()
  },
  setReplyingTo: (quote: ReplyQuote | null) => set({ replyingTo: quote }),

  // Persistence
  loadFromStorage: () => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        const readerId = generateReaderId()
        const username = generateRussianUsername()
        set({ readerId, username })
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ readerId, username }))
        return
      }
      const stored: StoredState = JSON.parse(raw)
      set({
        readerId: stored.readerId || generateReaderId(),
        username: stored.username || generateRussianUsername(),
        fontSize: stored.fontSize || 18,
        lineHeight: stored.lineHeight || 1.6,
        lineWidth: stored.lineWidth || 'medium',
        theme: stored.theme || 'light',
        readingMode: stored.readingMode || 'feed',
      })
    } catch {
      const readerId = generateReaderId()
      const username = generateRussianUsername()
      set({ readerId, username })
    }
  },

  saveToStorage: () => {
    if (typeof window === 'undefined') return
    try {
      const state = get()
      const toStore: StoredState = {
        readerId: state.readerId,
        username: state.username,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        lineWidth: state.lineWidth,
        theme: state.theme,
        readingMode: state.readingMode,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
    } catch {
      // silently fail
    }
  },
}))
