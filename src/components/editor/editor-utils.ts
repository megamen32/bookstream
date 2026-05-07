import type { EditorSaveStatus } from './editor-types'

const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'A',
  'H1',
  'H2',
  'H3',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'HR',
  'SUB',
  'SUP',
  'IMG',
  'TABLE',
  'TBODY',
  'THEAD',
  'TR',
  'TD',
  'TH',
  'DIV',
])

const ALLOWED_ATTRIBUTES = new Set([
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'colspan',
  'rowspan',
  'data-telegram-quote',
  'data-formula-block',
  'style',
])

export function sanitizeEditorHtml(html: string): string {
  if (typeof window === 'undefined') {
    return html
  }

  const template = document.createElement('template')
  template.innerHTML = html

  const walk = (node: Node): void => {
    const children = Array.from(node.childNodes)

    children.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement

        if (!ALLOWED_TAGS.has(element.tagName)) {
          element.replaceWith(...Array.from(element.childNodes))
          return
        }

        Array.from(element.attributes).forEach((attribute) => {
          if (!ALLOWED_ATTRIBUTES.has(attribute.name)) {
            element.removeAttribute(attribute.name)
          }
        })

        if (element.tagName === 'A') {
          element.setAttribute('target', '_blank')
          element.setAttribute('rel', 'noopener noreferrer')
        }

        if (element.tagName === 'IMG') {
          const src = element.getAttribute('src') || ''
          const isSupportedSource =
            src.startsWith('http') || src.startsWith('/') || src.startsWith('data:image/')

          if (!isSupportedSource) {
            element.remove()
            return
          }
        }
      }

      walk(child)
    })
  }

  walk(template.content)
  return template.innerHTML
}

export function getSaveStatusLabel(
  status?: EditorSaveStatus,
  saving?: boolean
): string {
  if (saving || status === 'saving') {
    return 'Сохраняю…'
  }

  if (status === 'dirty') {
    return 'Есть изменения'
  }

  if (status === 'saved') {
    return 'Сохранено'
  }

  if (status === 'error') {
    return 'Ошибка сохранения'
  }

  return 'Готово'
}

export function textToParagraphHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export const MATH_SYMBOL_GROUPS: Array<{ title: string; symbols: string[] }> = [
  {
    title: 'Частые',
    symbols: ['∫', '∑', '√', '∞', '≈', '≠', '≤', '≥', '±', '×', '·', '→', '←', '−'],
  },
  {
    title: 'Греческие',
    symbols: ['α', 'β', 'γ', 'δ', 'ε', 'λ', 'μ', 'π', 'σ', 'τ', 'φ', 'ω', 'Λ', 'Δ', 'Ω'],
  },
  {
    title: 'Нижние',
    symbols: ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₊', '₋', '₌', '₍', '₎'],
  },
  {
    title: 'Верхние',
    symbols: ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁺', '⁻', '⁼', '⁽', '⁾', 'ᵀ'],
  },
]
