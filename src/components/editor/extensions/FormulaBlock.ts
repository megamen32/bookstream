import { Node, mergeAttributes } from '@tiptap/core'

export interface FormulaBlockOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formulaBlock: {
      setFormulaBlock: (formula?: string) => ReturnType
      toggleFormulaBlock: () => ReturnType
    }
  }
}

export const FormulaBlock = Node.create<FormulaBlockOptions>({
  name: 'formulaBlock',
  group: 'block',
  content: 'inline*',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-formula-block="true"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-formula-block': 'true',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setFormulaBlock:
        (formula?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            content: formula ? [{ type: 'text', text: formula }] : [],
          })
        },
      toggleFormulaBlock:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        },
    }
  },
})
