import { Node, mergeAttributes } from '@tiptap/core'

export interface TelegramQuoteOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    telegramQuote: {
      setTelegramQuote: () => ReturnType
      toggleTelegramQuote: () => ReturnType
    }
  }
}

export const TelegramQuote = Node.create<TelegramQuoteOptions>({
  name: 'telegramQuote',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [
      {
        tag: 'blockquote[data-telegram-quote]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'blockquote',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-telegram-quote': 'true',
        'data-type': 'telegram-quote',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setTelegramQuote:
        () =>
        ({ commands }) => {
          return commands.wrapIn(this.name)
        },
      toggleTelegramQuote:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-q': () => this.editor.commands.toggleTelegramQuote(),
    }
  },
})
