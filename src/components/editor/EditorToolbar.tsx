'use client'

import type { ChangeEvent, ReactNode } from 'react'
import { useRef } from 'react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

interface ToolbarMenuItem {
  key: string
  label: string
  icon: ReactNode
  active?: boolean
  disabled?: boolean
  onSelect: () => void
}

interface ToolbarMenuButtonProps {
  title: string
  trigger: ReactNode
  items: ToolbarMenuItem[]
  active?: boolean
  contentClassName?: string
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

function ToolbarMenuButton({
  title,
  trigger,
  items,
  active,
  contentClassName,
}: ToolbarMenuButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={active ? 'secondary' : 'ghost'}
          size="icon"
          title={title}
          className={cn(
            'h-8 w-8 rounded-full',
            active && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
          )}
        >
          {trigger}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn('w-56 rounded-2xl p-1', contentClassName)}>
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            disabled={item.disabled}
            onSelect={item.onSelect}
            className={cn(
              'rounded-xl px-3 py-2',
              item.active && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            )}
          >
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
  }

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!onImageUpload) {
      const localUrl = URL.createObjectURL(file)
      editor.chain().focus().setImage({ src: localUrl, alt: file.name }).run()
      return
    }

    const uploadedUrl = await onImageUpload(file)
    editor.chain().focus().setImage({ src: uploadedUrl, alt: file.name }).run()
  }

  const insertFormulaBlock = (): void => {
    const formula = window.prompt('Формула', 'Pₛᵤᵣᵥ(T) = exp(−∫₀ᵀ Λ(t) dt)')

    if (formula === null) {
      return
    }

    editor.chain().focus().setFormulaBlock(formula).run()
  }

  const textStyleItems: ToolbarMenuItem[] = [
    {
      key: 'paragraph',
      label: 'Обычный текст',
      icon: <Type className="h-4 w-4" />,
      active: editor.isActive('paragraph'),
      onSelect: () => editor.chain().focus().setParagraph().run(),
    },
    {
      key: 'heading-1',
      label: 'Заголовок H1',
      icon: <Heading1 className="h-4 w-4" />,
      active: editor.isActive('heading', { level: 1 }),
      onSelect: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      key: 'heading-2',
      label: 'Подзаголовок H2',
      icon: <Heading2 className="h-4 w-4" />,
      active: editor.isActive('heading', { level: 2 }),
      onSelect: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
  ]
  const activeTextStyle = textStyleItems.find((item) => item.active) ?? textStyleItems[0]

  const alignmentItems: ToolbarMenuItem[] = [
    {
      key: 'align-left',
      label: 'Влево',
      icon: <AlignLeft className="h-4 w-4" />,
      active: editor.isActive({ textAlign: 'left' }),
      onSelect: () => editor.chain().focus().setTextAlign('left').run(),
    },
    {
      key: 'align-center',
      label: 'По центру',
      icon: <AlignCenter className="h-4 w-4" />,
      active: editor.isActive({ textAlign: 'center' }),
      onSelect: () => editor.chain().focus().setTextAlign('center').run(),
    },
    {
      key: 'align-right',
      label: 'Вправо',
      icon: <AlignRight className="h-4 w-4" />,
      active: editor.isActive({ textAlign: 'right' }),
      onSelect: () => editor.chain().focus().setTextAlign('right').run(),
    },
    {
      key: 'align-justify',
      label: 'По ширине',
      icon: <AlignJustify className="h-4 w-4" />,
      active: editor.isActive({ textAlign: 'justify' }),
      onSelect: () => editor.chain().focus().setTextAlign('justify').run(),
    },
  ]
  const activeAlignment = alignmentItems.find((item) => item.active) ?? alignmentItems[0]

  const insertItems: ToolbarMenuItem[] = [
    {
      key: 'insert-image-url',
      label: 'Картинка по URL',
      icon: <ImageIcon className="h-4 w-4" />,
      onSelect: insertImageByUrl,
    },
    {
      key: 'insert-image-file',
      label: 'Загрузить картинку',
      icon: <ImageIcon className="h-4 w-4" />,
      onSelect: () => fileInputRef.current?.click(),
    },
    {
      key: 'insert-table',
      label: 'Таблица 3×3',
      icon: <Table2 className="h-4 w-4" />,
      onSelect: () =>
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      key: 'insert-formula',
      label: 'Блок формулы',
      icon: <Sigma className="h-4 w-4" />,
      onSelect: insertFormulaBlock,
    },
  ]

  return (
    <div className="sticky top-0 z-20 flex w-full flex-col gap-3 rounded-t-3xl border-b bg-background/85 px-3 py-2 backdrop-blur md:px-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFileSelected(event)
        }}
      />

      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <div className="rounded-full bg-muted px-3 py-1">
            {getSaveStatusLabel(saveStatus, saving)}
          </div>
          <div className="rounded-full bg-muted px-3 py-1">
            {editor.storage.characterCount.words()} слов · {editor.storage.characterCount.characters()} символов
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex w-full min-w-0 flex-wrap items-center gap-1">
        <ToolbarMenuButton
          title={activeTextStyle.label}
          trigger={activeTextStyle.icon}
          items={textStyleItems}
          active={textStyleItems.some((item) => item.active)}
        />

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

        <ToolbarMenuButton
          title="Вставить"
          trigger={<Plus className="h-4 w-4" />}
          items={insertItems}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Математические символы" className="h-8 w-8 rounded-full">
              <Sigma className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 rounded-2xl p-3">
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
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarMenuButton
          title={activeAlignment.label}
          trigger={activeAlignment.icon}
          items={alignmentItems}
          active={alignmentItems.some((item) => item.active)}
        />

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
    </div>
  )
}
