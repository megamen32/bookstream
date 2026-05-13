import { parseFragment, serialize } from 'parse5'
import { slugify } from './slugify.ts'
import { hasReadableHtmlContent } from './book-content.ts'

interface DefaultTreeDocumentFragment {
  childNodes: DefaultTreeNode[]
}

interface DefaultTreeElement {
  nodeName: string
  tagName: string
  attrs: Array<{ name: string; value: string }>
  childNodes: DefaultTreeNode[]
}

interface DefaultTreeTextNode {
  nodeName: '#text'
  value: string
}

interface DefaultTreeOtherNode {
  nodeName: string
  childNodes?: DefaultTreeNode[]
}

type DefaultTreeNode = DefaultTreeElement | DefaultTreeTextNode | DefaultTreeOtherNode

export interface ImportedBookSection {
  id: string
  title: string
  level: number
  order: number
  contentHtml: string
  isReadable: boolean
  children: ImportedBookSection[]
}

interface NormalizationContext {
  usedFragmentIds: Set<string>
  fragmentAliases: Map<string, string>
  headingCount: number
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const BLOCK_UNWRAP_TAGS = new Set([
  'article',
  'aside',
  'body',
  'caption',
  'center',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'div',
  'figcaption',
  'figure',
  'footer',
  'header',
  'main',
  'section',
  'span',
])
const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'article',
  'aside',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'div',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'li',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
])
const ALLOWED_ATTRS = new Set([
  'alt',
  'colspan',
  'data-formula-block',
  'data-telegram-quote',
  'href',
  'id',
  'rel',
  'rowspan',
  'src',
  'style',
  'target',
  'title',
])

/**
 * Normalizes imported HTML by stripping dangerous nodes, preserving links and
 * fragment ids, and assigning stable ids to headings.
 *
 * @param html HTML returned by Mammoth.
 * @returns Sanitized and fragment-stable HTML.
 */
export function normalizeImportedHtml(html: string): string {
  const fragment = parseFragment(html) as DefaultTreeDocumentFragment
  const context = createNormalizationContext()

  fragment.childNodes = sanitizeNodes(fragment.childNodes, context)
  rewriteInternalLinks(fragment.childNodes, context)

  return serialize(fragment as never)
}

/**
 * Splits sanitized HTML into a nested section tree.
 *
 * @param html Sanitized imported HTML.
 * @param fallbackTitle Title used when a document starts before its first heading.
 * @returns Nested section tree suitable for chapter creation.
 */
export function splitImportedHtmlIntoSections(html: string, fallbackTitle: string): ImportedBookSection[] {
  const fragment = parseFragment(html) as DefaultTreeDocumentFragment
  const sections: ImportedBookSection[] = []
  const stack: ImportedBookSection[] = []
  const leadingNodes: DefaultTreeNode[] = []
  let hasHeading = false

  for (const node of fragment.childNodes) {
    if (isHeadingElement(node)) {
      hasHeading = true
      if (leadingNodes.length > 0) {
        appendLeadingSection(sections, leadingNodes, fallbackTitle)
        leadingNodes.length = 0
      }

      const level = Number.parseInt(node.tagName.slice(1), 10)
      const title = collapseWhitespace(extractTextContent(node.childNodes)) || `${fallbackTitle}`
      const section: ImportedBookSection = {
        id: getElementFragmentId(node) || slugify(title) || `section-${sections.length + 1}`,
        title,
        level,
        order: 0,
        contentHtml: '',
        isReadable: false,
        children: [],
      }

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      const parent = stack[stack.length - 1] || null
      if (parent) {
        parent.children.push(section)
      } else {
        sections.push(section)
      }

      stack.push(section)
      continue
    }

    if (stack.length === 0) {
      leadingNodes.push(node)
      continue
    }

    stack[stack.length - 1].contentHtml += serializeNodes([node])
  }

  if (!hasHeading) {
    return splitWithoutHeadings(fragment.childNodes, fallbackTitle)
  }

  if (leadingNodes.length > 0) {
    appendLeadingSection(sections, leadingNodes, fallbackTitle)
  }

  assignSectionMetadata(sections)
  return sections
}

/**
 * Flattens a nested section tree in document order.
 *
 * @param sections Section tree returned by `splitImportedHtmlIntoSections`.
 * @returns Flattened section list with stable positions.
 */
export function flattenImportedSections(sections: ImportedBookSection[]): ImportedBookSection[] {
  const flattened: ImportedBookSection[] = []

  const visit = (section: ImportedBookSection): void => {
    const contentHtml = section.contentHtml.trim()
    flattened.push({
      ...section,
      contentHtml,
      isReadable: hasReadableHtmlContent(contentHtml),
      children: [],
      order: flattened.length,
    })

    for (const child of section.children) {
      visit(child)
    }
  }

  for (const section of sections) {
    visit(section)
  }

  return flattened
}

function createNormalizationContext(): NormalizationContext {
  return {
    usedFragmentIds: new Set<string>(),
    fragmentAliases: new Map<string, string>(),
    headingCount: 0,
  }
}

function sanitizeNodes(nodes: DefaultTreeNode[], context: NormalizationContext): DefaultTreeNode[] {
  const sanitized: DefaultTreeNode[] = []

  for (const node of nodes) {
    if (isTextNode(node)) {
      sanitized.push(node)
      continue
    }

    if (!isElementNode(node)) {
      continue
    }

    const tagName = node.tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tagName)) {
      sanitized.push(...sanitizeNodes(node.childNodes ?? [], context))
      continue
    }

    node.attrs = sanitizeAttributes(node, context)
    node.childNodes = sanitizeNodes(node.childNodes ?? [], context)

    if (HEADING_TAGS.has(tagName)) {
      ensureHeadingId(node, context)
    }

    sanitized.push(node)
  }

  return sanitized
}

function sanitizeAttributes(node: DefaultTreeElement, context: NormalizationContext): DefaultTreeElement['attrs'] {
  const tagName = node.tagName.toLowerCase()
  const attrs: DefaultTreeElement['attrs'] = []

  for (const attr of node.attrs) {
    if (attr.name === 'style' || attr.name === 'title' || attr.name === 'alt' || attr.name === 'colspan' || attr.name === 'rowspan') {
      attrs.push(attr)
      continue
    }

    if (attr.name.startsWith('data-') && ALLOWED_ATTRS.has(attr.name)) {
      attrs.push(attr)
      continue
    }

    if (tagName === 'a' && attr.name === 'href') {
      attrs.push(attr)
      continue
    }

    if (tagName === 'a' && (attr.name === 'target' || attr.name === 'rel')) {
      attrs.push(attr)
      continue
    }

    if (tagName === 'img' && attr.name === 'src') {
      const src = attr.value.trim()
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/') || src.startsWith('data:image/')) {
        attrs.push(attr)
      }
      continue
    }

    if (attr.name === 'id') {
      attrs.push(attr)
      context.fragmentAliases.set(normalizeFragmentAlias(attr.value), attr.value)
      continue
    }

    if (ALLOWED_ATTRS.has(attr.name)) {
      attrs.push(attr)
    }
  }

  if (tagName === 'a') {
    const href = getAttributeValue(node, 'href') || ''
    if (href.startsWith('#')) {
      setAttribute(attrs, 'rel', null)
      setAttribute(attrs, 'target', null)
    } else if (href) {
      setAttribute(attrs, 'target', '_blank')
      setAttribute(attrs, 'rel', 'noopener noreferrer')
    }
  }

  return attrs.filter((attr) => attr.value !== null)
}

function ensureHeadingId(node: DefaultTreeElement, context: NormalizationContext): void {
  const headingText = collapseWhitespace(extractTextContent(node.childNodes))
  const existingId = getAttributeValue(node, 'id')
  const baseId = existingId || slugify(headingText) || `section-${context.headingCount + 1}`
  const fragmentId = ensureUniqueFragmentId(baseId, context.usedFragmentIds)

  context.headingCount += 1
  setAttribute(node.attrs, 'id', fragmentId)
  context.fragmentAliases.set(normalizeFragmentAlias(fragmentId), fragmentId)
  if (existingId) {
    context.fragmentAliases.set(normalizeFragmentAlias(existingId), fragmentId)
  }
  if (headingText) {
    context.fragmentAliases.set(normalizeFragmentAlias(headingText), fragmentId)
  }
}

function rewriteInternalLinks(nodes: DefaultTreeNode[], context: NormalizationContext): void {
  for (const node of nodes) {
    if (!isElementNode(node)) {
      continue
    }

    if (node.tagName.toLowerCase() === 'a') {
      const href = getAttributeValue(node, 'href')
      if (href?.startsWith('#')) {
        const target = href.slice(1)
        const resolvedId = context.fragmentAliases.get(normalizeFragmentAlias(target))
        if (resolvedId) {
          setAttribute(node.attrs, 'href', `#${resolvedId}`)
        }
      }
    }

    rewriteInternalLinks(node.childNodes ?? [], context)
  }
}

function splitWithoutHeadings(nodes: DefaultTreeNode[], fallbackTitle: string): ImportedBookSection[] {
  const fragment = parseFragment('') as DefaultTreeDocumentFragment
  fragment.childNodes = nodes
  const html = serialize(fragment as never)
  const paragraphs = html.match(/<p\b[\s\S]*?<\/p>/gi) || []

  if (paragraphs.length === 0) {
    const contentHtml = html.trim()
    return [{
      id: slugify(fallbackTitle) || 'section-1',
      title: fallbackTitle,
      level: 1,
      order: 0,
      contentHtml,
      isReadable: hasReadableHtmlContent(contentHtml),
      children: [],
    }]
  }

  const sections: ImportedBookSection[] = []
  const chunkSize = 10

  for (let index = 0; index < paragraphs.length; index += chunkSize) {
    const chunk = paragraphs.slice(index, index + chunkSize).join('')
    const title = index === 0 ? fallbackTitle : `Глава ${sections.length + 1}`
    sections.push({
      id: slugify(title) || `section-${sections.length + 1}`,
      title,
      level: 1,
      order: sections.length,
      contentHtml: chunk,
      isReadable: hasReadableHtmlContent(chunk),
      children: [],
    })
  }

  return sections
}

function appendLeadingSection(
  sections: ImportedBookSection[],
  leadingNodes: DefaultTreeNode[],
  fallbackTitle: string,
): void {
  const contentHtml = serializeNodes(leadingNodes).trim()
  if (!hasReadableHtmlContent(contentHtml)) {
    return
  }

  sections.unshift({
    id: slugify(fallbackTitle) || `section-${sections.length + 1}`,
    title: fallbackTitle,
    level: 1,
    order: 0,
    contentHtml,
    isReadable: true,
    children: [],
  })
}

function assignSectionMetadata(sections: ImportedBookSection[]): void {
  let order = 0

  const visit = (section: ImportedBookSection): void => {
    section.order = order
    section.isReadable = hasReadableHtmlContent(section.contentHtml)
    order += 1

    for (const child of section.children) {
      visit(child)
    }
  }

  for (const section of sections) {
    visit(section)
  }
}

function serializeNodes(nodes: DefaultTreeNode[]): string {
  const fragment = parseFragment('') as DefaultTreeDocumentFragment
  fragment.childNodes = nodes
  return serialize(fragment as never)
}

function ensureUniqueFragmentId(baseId: string, usedIds: Set<string>): string {
  let candidate = slugify(baseId) || 'section'
  let suffix = 2

  while (usedIds.has(candidate)) {
    candidate = `${slugify(baseId) || 'section'}-${suffix}`
    suffix += 1
  }

  usedIds.add(candidate)
  return candidate
}

function normalizeFragmentAlias(value: string): string {
  return slugify(value) || value.toLowerCase().trim()
}

function extractTextContent(nodes: DefaultTreeNode[]): string {
  return nodes.map((node) => {
    if (isTextNode(node)) {
      return node.value
    }

    if (isElementNode(node)) {
      return extractTextContent(node.childNodes ?? [])
    }

    return ''
  }).join(' ')
}

function setAttribute(attrs: DefaultTreeElement['attrs'], name: string, value: string | null): void {
  const existing = attrs.find((attr) => attr.name === name)
  if (existing) {
    if (value === null) {
      const index = attrs.indexOf(existing)
      attrs.splice(index, 1)
      return
    }

    existing.value = value
    return
  }

  if (value !== null) {
    attrs.push({ name, value })
  }
}

function getAttributeValue(node: DefaultTreeElement, name: string): string | null {
  return node.attrs.find((attr) => attr.name === name)?.value ?? null
}

function getElementFragmentId(node: DefaultTreeElement): string | null {
  return getAttributeValue(node, 'id')
}

function isElementNode(node: DefaultTreeNode): node is DefaultTreeElement {
  return 'tagName' in node
}

function isTextNode(node: DefaultTreeNode): node is { nodeName: '#text'; value: string } {
  return node.nodeName === '#text'
}

function isHeadingElement(node: DefaultTreeNode): node is DefaultTreeElement {
  return isElementNode(node) && HEADING_TAGS.has(node.tagName.toLowerCase())
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
