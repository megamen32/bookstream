'use client'

import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import CharacterCount from '@tiptap/extension-character-count'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  Bold,
  Heading1,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  MessageSquarePlus,
  Quote,
  Sigma,
  Sparkles,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { EditorToolbar } from './EditorToolbar'
import { sanitizeEditorHtml, textToParagraphHtml } from './editor-utils'
import { FormulaBlock } from './extensions/FormulaBlock'
import { TelegramQuote } from './extensions/TelegramQuote'
import type { BookTextEditorProps } from './editor-types'

interface ShortcutEvent {
  ctrlKey: boolean
  metaKey: boolean
  key: string
  preventDefault: () => void
  stopPropagation: () => void
}

export function BookTextEditor({
  value,
  title,
  placeholder = 'Начните писать…',
  titlePlaceholder = 'Название главы',
  saving,
  saveStatus,
  saveDisabled,
  onChange,
  onTitleChange,
  onSave,
  onImageUpload,
  className,
}: BookTextEditorProps) {
  const [focusMode, setFocusMode] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement | null>(null)

  const handleShortcut = (event: ShortcutEvent): boolean => {
    if (!event.ctrlKey && !event.metaKey) {
      return false
    }

    const normalizedKey = event.key.toLowerCase()

    if (normalizedKey === 's') {
      event.preventDefault()
      event.stopPropagation()
      void onSave?.()
      return true
    }

    if (normalizedKey === 'b') {
      event.preventDefault()
      editor?.chain().focus().toggleBold().run()
      return true
    }

    return false
  }

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'bookstream-prose min-h-[560px] w-full max-w-none outline-none selection:bg-emerald-300/30',
      },
      handlePaste(_view, event) {
        const html = event.clipboardData?.getData('text/html')
        const text = event.clipboardData?.getData('text/plain')

        if (!html && !text) {
          return false
        }

        event.preventDefault()

        const content = html ? sanitizeEditorHtml(html) : textToParagraphHtml(text || '')

        if (content) {
          editor?.chain().focus().insertContent(content).run()
        }

        return true
      },
      handleKeyDown(_view, event) {
        return handleShortcut(event)
      },
    },
    extensions: [
      StarterKit.configure({
        blockquote: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Subscript,
      Superscript,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'bookstream-image',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'bookstream-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph', 'formulaBlock'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      CharacterCount,
      TelegramQuote,
      FormulaBlock,
    ],
    content: value || '',
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }

    const currentHtml = editor.getHTML()
    const nextHtml = value || ''

    if (currentHtml !== nextHtml) {
      editor.commands.setContent(nextHtml, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    const textarea = titleRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [title])

  if (!editor) {
    return <div className="min-h-[640px] animate-pulse rounded-3xl border bg-muted/40" />
  }

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

  return (
    <div
      className={cn(
        'relative rounded-3xl border bg-background transition-all',
        'border-border shadow-[0_18px_70px_rgba(0,0,0,0.05)]',
        focusMode && 'fixed inset-3 z-50 overflow-auto bg-background p-2 md:inset-8 md:p-4',
        className
      )}
    >
      <EditorToolbar
        editor={editor}
        saving={saving}
        saveStatus={saveStatus}
        saveDisabled={saveDisabled}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((value) => !value)}
        onSave={onSave}
        onImageUpload={onImageUpload}
      />

      <BubbleMenu
        editor={editor}
        options={{ placement: 'top' }}
        className="flex items-center gap-1 rounded-full border bg-background/95 p-1 shadow-xl backdrop-blur"
      >
        <Button
          type="button"
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('subscript') ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        >
          <SubscriptIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('superscript') ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        >
          <SuperscriptIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('link') ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={setLink}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('telegramQuote') ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().toggleTelegramQuote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('formulaBlock') ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().toggleFormulaBlock().run()}
        >
          <Sigma className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          title="Заготовка под AI-действие по выделенному тексту"
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          AI
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          title="Заготовка под комментарий к выделенному фрагменту"
        >
          <MessageSquarePlus className="mr-1 h-3.5 w-3.5" />
          Коммент
        </Button>
      </BubbleMenu>

      <FloatingMenu
        editor={editor}
        options={{ placement: 'left' }}
        className="hidden items-center gap-1 rounded-full border bg-background/95 p-1 shadow-xl backdrop-blur md:flex"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().toggleTelegramQuote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => {
            const url = window.prompt('URL картинки', 'https://')

            if (url?.trim()) {
              editor.chain().focus().setImage({ src: url.trim() }).run()
            }
          }}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
      </FloatingMenu>

      <div className="w-full px-5 py-8 md:px-10 md:py-12">
        {onTitleChange ? (
          <Textarea
            ref={titleRef}
            value={title ?? ''}
            onChange={(event) => onTitleChange(event.target.value)}
            onKeyDown={(event) => {
              handleShortcut(event)
            }}
            placeholder={titlePlaceholder}
            aria-label={titlePlaceholder}
            rows={1}
            className={cn(
              'mb-6 min-h-0 max-w-[18ch] resize-none overflow-hidden border-0 bg-transparent px-0 py-0',
              'text-4xl font-black tracking-[-0.06em] text-foreground shadow-none md:text-5xl',
              'whitespace-pre-wrap break-words leading-[0.95]',
              'placeholder:text-muted-foreground/55 focus-visible:border-0 focus-visible:ring-0'
            )}
          />
        ) : null}

        <EditorContent editor={editor} />
      </div>

      <style jsx global>{`
        .bookstream-prose {
          font-size: 19px;
          line-height: 1.85;
          color: hsl(var(--foreground));
        }

        .bookstream-prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          color: hsl(var(--muted-foreground) / 0.62);
        }

        .bookstream-prose h1 {
          margin: 0 0 1.1rem;
          font-size: clamp(2.1rem, 5vw, 3.2rem);
          line-height: 1.05;
          font-weight: 780;
          letter-spacing: -0.055em;
        }

        .bookstream-prose h2 {
          margin: 2rem 0 0.85rem;
          font-size: clamp(1.55rem, 3vw, 2.1rem);
          line-height: 1.15;
          font-weight: 740;
          letter-spacing: -0.035em;
        }

        .bookstream-prose h3 {
          margin: 1.6rem 0 0.65rem;
          font-size: 1.25rem;
          line-height: 1.25;
          font-weight: 700;
        }

        .bookstream-prose p {
          margin: 1rem 0;
        }

        .bookstream-prose sub,
        .bookstream-prose sup {
          line-height: 0;
        }

        .bookstream-prose ul,
        .bookstream-prose ol {
          margin: 1rem 0;
          padding-left: 1.45rem;
        }

        .bookstream-prose li {
          margin: 0.35rem 0;
        }

        .bookstream-prose a {
          text-decoration: underline;
          text-underline-offset: 4px;
          color: rgb(5 150 105);
        }

        .bookstream-prose hr {
          margin: 2.4rem auto;
          width: 4.5rem;
          border: 0;
          border-top: 1px solid hsl(var(--border));
        }

        .bookstream-prose img.bookstream-image {
          display: block;
          max-width: 100%;
          max-height: 70vh;
          margin: 1.6rem auto;
          border-radius: 22px;
          border: 1px solid hsl(var(--border));
          object-fit: contain;
          box-shadow: 0 18px 50px rgb(0 0 0 / 0.08);
        }

        .bookstream-prose blockquote[data-telegram-quote='true'] {
          position: relative;
          margin: 1.55rem 0;
          padding: 0.85rem 1rem 0.85rem 1.15rem;
          border-left: 4px solid rgb(16 185 129 / 0.85);
          border-radius: 0 18px 18px 0;
          background: linear-gradient(90deg, rgb(16 185 129 / 0.12), rgb(16 185 129 / 0.045));
          color: hsl(var(--foreground));
        }

        .bookstream-prose blockquote[data-telegram-quote='true']::before {
          content: '';
          position: absolute;
          left: -4px;
          top: 0;
          height: 100%;
          width: 4px;
          border-radius: 999px;
          background: rgb(16 185 129);
          box-shadow: 0 0 18px rgb(16 185 129 / 0.28);
        }

        .bookstream-prose blockquote[data-telegram-quote='true'] p {
          margin: 0.45rem 0;
        }

        .bookstream-prose div[data-formula-block='true'] {
          margin: 1.6rem 0;
          padding: 1rem 1.15rem;
          overflow-x: auto;
          border: 1px solid hsl(var(--border));
          border-radius: 20px;
          background: hsl(var(--muted) / 0.55);
          font-family: ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
          text-align: center;
          white-space: nowrap;
        }

        .bookstream-prose table.bookstream-table {
          width: 100%;
          margin: 1.5rem 0;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
          border: 1px solid hsl(var(--border));
          border-radius: 18px;
          font-size: 0.94em;
        }

        .bookstream-prose table.bookstream-table th,
        .bookstream-prose table.bookstream-table td {
          min-width: 90px;
          padding: 0.65rem 0.75rem;
          border-right: 1px solid hsl(var(--border));
          border-bottom: 1px solid hsl(var(--border));
          vertical-align: top;
        }

        .bookstream-prose table.bookstream-table th {
          background: hsl(var(--muted) / 0.75);
          font-weight: 650;
        }

        .bookstream-prose table.bookstream-table tr:last-child td {
          border-bottom: 0;
        }

        .bookstream-prose table.bookstream-table th:last-child,
        .bookstream-prose table.bookstream-table td:last-child {
          border-right: 0;
        }

        .bookstream-prose .selectedCell::after {
          position: absolute;
          inset: 0;
          z-index: 2;
          content: '';
          pointer-events: none;
          background: rgb(16 185 129 / 0.12);
        }

        .bookstream-prose .ProseMirror:focus {
          outline: none;
        }
      `}</style>
    </div>
  )
}
