import type { Editor } from '@tiptap/react'

export type EditorSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface BookTextEditorProps {
  value: string
  placeholder?: string
  saving?: boolean
  saveStatus?: EditorSaveStatus
  onChange: (html: string) => void
  onSave?: () => void | Promise<void>
  onImageUpload?: (file: File) => Promise<string>
  className?: string
}

export interface EditorToolbarProps {
  editor: Editor
  saving?: boolean
  saveStatus?: EditorSaveStatus
  focusMode: boolean
  onToggleFocusMode: () => void
  onSave?: () => void | Promise<void>
  onImageUpload?: (file: File) => Promise<string>
}
