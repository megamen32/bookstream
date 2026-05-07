import type { Editor } from '@tiptap/react'

export type EditorSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface BookTextEditorProps {
  value: string
  title?: string
  placeholder?: string
  titlePlaceholder?: string
  saving?: boolean
  saveStatus?: EditorSaveStatus
  saveDisabled?: boolean
  onChange: (html: string) => void
  onTitleChange?: (title: string) => void
  onSave?: () => void | Promise<void>
  onImageUpload?: (file: File) => Promise<string>
  className?: string
}

export interface EditorToolbarProps {
  editor: Editor
  saving?: boolean
  saveStatus?: EditorSaveStatus
  saveDisabled?: boolean
  focusMode: boolean
  onToggleFocusMode: () => void
  onSave?: () => void | Promise<void>
  onImageUpload?: (file: File) => Promise<string>
}
