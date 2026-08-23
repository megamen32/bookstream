import path from 'node:path'
import { Document, HeadingLevel, Packer, Paragraph } from 'docx'
import JSZip from 'jszip'
import PDFDocument from 'pdfkit'

export const BOOK_EXPORT_FORMATS = ['md', 'pdf', 'docx', 'epub', 'fb2'] as const
export type BookExportFormat = typeof BOOK_EXPORT_FORMATS[number]

export interface ExportableBook {
  title: string
  authorName: string
  description: string | null
  chapters: Array<{ title: string; contentHtml: string }>
}

export interface BookExportFile {
  buffer: Buffer
  contentType: string
  fileName: string
}

const exportMetadata: Record<BookExportFormat, { extension: string; contentType: string }> = {
  md: { extension: 'md', contentType: 'text/markdown; charset=utf-8' },
  pdf: { extension: 'pdf', contentType: 'application/pdf' },
  docx: { extension: 'docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  epub: { extension: 'epub', contentType: 'application/epub+zip' },
  fb2: { extension: 'fb2', contentType: 'application/x-fictionbook+xml; charset=utf-8' },
}

export function isBookExportFormat(value: string): value is BookExportFormat {
  return BOOK_EXPORT_FORMATS.includes(value as BookExportFormat)
}

export async function buildBookExport(book: ExportableBook, format: BookExportFormat): Promise<BookExportFile> {
  const metadata = exportMetadata[format]
  const buffer = format === 'md'
    ? Buffer.from(toMarkdown(book), 'utf8')
    : format === 'pdf'
      ? await toPdf(book)
      : format === 'docx'
        ? await toDocx(book)
        : format === 'epub'
          ? await toEpub(book)
          : Buffer.from(toFb2(book), 'utf8')

  return { buffer, contentType: metadata.contentType, fileName: `${sanitizeFileName(book.title)}.${metadata.extension}` }
}

function toMarkdown(book: ExportableBook): string {
  return `${[
    `# ${book.title}`,
    `Автор: ${book.authorName}`,
    book.description?.trim() || '',
    ...book.chapters.flatMap((chapter) => [`## ${chapter.title}`, paragraphsFromHtml(chapter.contentHtml).join('\n\n')]),
  ].filter(Boolean).join('\n\n')}\n`
}

async function toDocx(book: ExportableBook): Promise<Buffer> {
  const children = [
    new Paragraph({ text: book.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `Автор: ${book.authorName}` }),
    ...(book.description?.trim() ? [new Paragraph({ text: book.description.trim() })] : []),
    ...book.chapters.flatMap((chapter) => [
      new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_1 }),
      ...paragraphsFromHtml(chapter.contentHtml).map((text) => new Paragraph({ text })),
    ]),
  ]
  return Buffer.from(await Packer.toBuffer(new Document({ sections: [{ children }] })))
}

function toPdf(book: ExportableBook): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 54, info: { Title: book.title, Author: book.authorName } })
    const chunks: Buffer[] = []
    document.on('data', (chunk: Buffer) => chunks.push(chunk))
    document.on('end', () => resolve(Buffer.concat(chunks)))
    document.on('error', reject)
    document.registerFont('Noto Sans', path.join(process.cwd(), 'public', 'fonts', 'noto-sans-cyrillic-400-normal.woff'))
    document.font('Noto Sans').fontSize(22).text(book.title)
    document.moveDown(0.4)
    document.fontSize(11).fillColor('#555555').text(`Автор: ${book.authorName}`)
    if (book.description?.trim()) document.moveDown().fillColor('#333333').text(book.description.trim())
    for (const chapter of book.chapters) {
      document.addPage().fontSize(18).fillColor('#111111').text(chapter.title)
      document.moveDown().fontSize(11).fillColor('#222222')
      for (const paragraph of paragraphsFromHtml(chapter.contentHtml)) {
        document.text(paragraph, { align: 'left', lineGap: 4 })
        document.moveDown(0.8)
      }
    }
    document.end()
  })
}

async function toEpub(book: ExportableBook): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
  const chapters = book.chapters.map((chapter, index) => ({ id: `chapter-${index + 1}`, href: `chapter-${index + 1}.xhtml`, title: chapter.title, paragraphs: paragraphsFromHtml(chapter.contentHtml) }))
  for (const chapter of chapters) zip.file(`OEBPS/${chapter.href}`, xhtmlDocument(chapter.title, chapter.paragraphs))
  const manifest = ['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', ...chapters.map((chapter) => `<item id="${chapter.id}" href="${chapter.href}" media-type="application/xhtml+xml"/>`)].join('')
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${epubId(book)}</dc:identifier><dc:title>${escapeXml(book.title)}</dc:title><dc:creator>${escapeXml(book.authorName)}</dc:creator><dc:language>ru</dc:language></metadata><manifest>${manifest}</manifest><spine>${chapters.map((chapter) => `<itemref idref="${chapter.id}"/>`).join('')}</spine></package>`)
  zip.file('OEBPS/nav.xhtml', xhtmlDocument('Содержание', chapters.map((chapter) => chapter.title), true))
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
}

function toFb2(book: ExportableBook): string {
  const sections = book.chapters.map((chapter) => `<section><title><p>${escapeXml(chapter.title)}</p></title>${paragraphsFromHtml(chapter.contentHtml).map((paragraph) => `<p>${escapeXml(paragraph)}</p>`).join('')}</section>`).join('')
  const annotation = book.description?.trim() ? `<annotation><p>${escapeXml(book.description.trim())}</p></annotation>` : ''
  return `<?xml version="1.0" encoding="utf-8"?>\n<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>${escapeXml(book.title)}</book-title><author><nickname>${escapeXml(book.authorName)}</nickname></author><lang>ru</lang>${annotation}</title-info></description><body>${sections}</body></FictionBook>\n`
}

function xhtmlDocument(title: string, paragraphs: string[], navigation = false): string {
  const body = navigation
    ? `<nav epub:type="toc" id="toc"><ol>${paragraphs.map((paragraph, index) => `<li><a href="chapter-${index + 1}.xhtml">${escapeXml(paragraph)}</a></li>`).join('')}</ol></nav>`
    : `<h1>${escapeXml(title)}</h1>${paragraphs.map((paragraph) => `<p>${escapeXml(paragraph)}</p>`).join('')}`
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${escapeXml(title)}</title><meta charset="utf-8"/></head><body>${body}</body></html>`
}

function paragraphsFromHtml(html: string): string[] {
  const text = decodeHtmlEntities(html).replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '').replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\s*\/\s*(p|div|h[1-6]|li|blockquote|tr)\s*>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/\r/g, '')
  return text.split(/\n\s*\n+/).map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code))).replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
}

function sanitizeFileName(title: string): string {
  return (title || 'book').replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 120) || 'book'
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function epubId(book: ExportableBook): string {
  return Buffer.from(`${book.title}:${book.authorName}`).toString('hex').slice(0, 32)
}
