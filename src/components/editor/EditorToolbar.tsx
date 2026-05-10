'use client'

import type { ChangeEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Focus,
  Heading1,
  Heading2,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo2,
  Save,
  Sigma,
  Subscript,
  Superscript,
  Table2,
  TableCellsMerge,
  TableColumnsSplit,
  Type,
  Underline,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getSaveStatusLabel, MATH_SYMBOL_GROUPS } from './editor-utils'
import type { EditorToolbarProps } from './editor-types'

interface ToolbarButtonProps {
  active?: boolean
  title: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}

function ToolbarButton({
  active,
  title,
  onClick,
  children,
  disabled,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'h-8 w-8 rounded-full',
        active && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
      )}
    >
      {children}
    </Button>
  )
}

export function EditorToolbar({
  editor,
  saving,
  saveStatus,
  saveDisabled,
  focusMode,
  onToggleFocusMode,
  onSave,
  onImageUpload,
}: EditorToolbarProps) {
  const [insertMenuOpen, setInsertMenuOpen] = useState(false)
  const [symbolsOpen, setSymbolsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const setLink = (): void => {
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Ссылка', previousUrl || 'https://')

    if (url === null) {
      return
    }

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const insertImageByUrl = (): void => {
    const url = window.prompt('URL картинки', 'https://')

    if (!url?.trim()) {
      return
    }

    editor.chain().focus().setImage({ src: url.trim() }).run()
    setInsertMenuOpen(false)
  }

  const handleFileSelected = async (
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!onImageUpload) {
      const localUrl = URL.createObjectURL(file)
      editor.chain().focus().setImage({ src: localUrl, alt: file.name }).run()
      setInsertMenuOpen(false)
      return
    }

    const uploadedUrl = await onImageUpload(file)
    editor.chain().focus().setImage({ src: uploadedUrl, alt: file.name }).run()
    setInsertMenuOpen(false)
  }

  const insertFormulaBlock = (): void => {
    const formula = window.prompt('Формула', 'Pₛᵤᵣᵥ(T) = exp(−∫₀ᵀ Λ(t) dt)')

    if (formula === null) {
      return
    }

    editor.chain().focus().setFormulaBlock(formula).run()
    setInsertMenuOpen(false)
  }

  return (
    <div className="sticky top-0 z-20 flex w-full flex-col gap-3 rounded-t-3xl border-b bg-background/85 px-3 py-2 backdrop-blur md:px-4 xl:flex-row xl:items-center xl:justify-between">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFileSelected(event)
        }}
      />

      <div className="flex w-full min-w-0 flex-wrap items-center gap-1 xl:flex-1">
        <ToolbarButton
          title="Обычный текст"
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Type className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Заголовок"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Подзаголовок"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Жирный"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Курсив"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Подчёркивание"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Нижний индекс x₂"
          active={editor.isActive('subscript')}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        >
          <Subscript className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Верхний индекс x²"
          active={editor.isActive('superscript')}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        >
          <Superscript className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Ссылка"
          active={editor.isActive('link')}
          onClick={setLink}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Telegram-цитата"
          active={editor.isActive('telegramQuote')}
          onClick={() => editor.chain().focus().toggleTelegramQuote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Маркированный список"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Нумерованный список"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Разделитель"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <div className="relative">
          <ToolbarButton
            title="Вставить"
            active={insertMenuOpen}
            onClick={() => setInsertMenuOpen((value) => !value)}
          >
            <Plus className="h-4 w-4" />
          </ToolbarButton>

          {insertMenuOpen && (
            <div className="absolute left-0 top-10 z-40 w-56 rounded-2xl border bg-background p-1 shadow-xl">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={insertImageByUrl}
              >
                <ImageIcon className="h-4 w-4" />
                Картинка по URL
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4" />
                Загрузить картинку
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              >
                <Table2 className="h-4 w-4" />
                Таблица 3×3
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={insertFormulaBlock}
              >
                <Sigma className="h-4 w-4" />
                Блок формулы
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <ToolbarButton
            title="Математические символы"
            active={symbolsOpen}
            onClick={() => setSymbolsOpen((value) => !value)}
          >
            <Sigma className="h-4 w-4" />
          </ToolbarButton>

          {symbolsOpen && (
            <div className="absolute left-0 top-10 z-40 w-80 rounded-2xl border bg-background p-3 shadow-xl">
              <div className="space-y-3">
                {MATH_SYMBOL_GROUPS.map((group) => (
                  <div key={group.title}>
                    <div className="mb-1 text-xs text-muted-foreground">{group.title}</div>
                    <div className="flex flex-wrap gap-1">
                      {group.symbols.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm hover:bg-muted"
                          onClick={() => editor.chain().focus().insertContent(symbol).run()}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Влево"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="По центру"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Вправо"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="По ширине"
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Объединить ячейки"
          disabled={!editor.isActive('table')}
          onClick={() => editor.chain().focus().mergeCells().run()}
        >
          <TableCellsMerge className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Разделить ячейки"
          disabled={!editor.isActive('table')}
          onClick={() => editor.chain().focus().splitCell().run()}
        >
          <TableColumnsSplit className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Очистить формат"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <Eraser className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Отменить"
          disabled={!editor.can().chain().focus().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Повторить"
          disabled={!editor.can().chain().focus().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
        <div className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:block">
          {getSaveStatusLabel(saveStatus, saving)}
        </div>
        <div className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:block">
          {editor.storage.characterCount.words()} слов · {editor.storage.characterCount.characters()} символов
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={onToggleFocusMode}
        >
          <Focus className="mr-1 h-4 w-4" />
          {focusMode ? 'Обычный режим' : 'Фокус'}
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={saving || saveDisabled}
          onClick={() => {
            void onSave?.()
          }}
        >
          <Save className="mr-1 h-4 w-4" />
          Сохранить
        </Button>
      </div>
    </div>
  )
}
