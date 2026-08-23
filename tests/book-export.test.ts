import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import JSZip from 'jszip'
import { buildBookExport } from '../src/lib/book-export.ts'

const book = {
  title: 'Тестовая книга',
  authorName: 'Анна Автор',
  description: 'Небольшое описание книги.',
  chapters: [
    { title: 'Первая глава', contentHtml: '<p>Первый абзац.</p><p>Второй <strong>абзац</strong>.</p>' },
    { title: 'Вторая глава', contentHtml: '<p>Финальный текст.</p>' },
  ],
}

describe('book export', () => {
  for (const format of ['md', 'pdf', 'docx', 'epub', 'fb2'] as const) {
    it(`creates a ${format.toUpperCase()} file with the book content`, async () => {
      const result = await buildBookExport(book, format)

      assert.equal(result.fileName.endsWith(`.${format}`), true)
      assert.ok(result.buffer.length > 100)
    })
  }

  it('uses a safe download name', async () => {
    const result = await buildBookExport({ ...book, title: 'Книга: тест / 2026' }, 'md')

    assert.equal(result.fileName, 'Книга-тест-2026.md')
    assert.match(result.buffer.toString('utf8'), /Первый абзац/)
  })

  it('writes open document structures for DOCX and EPUB', async () => {
    const docx = await buildBookExport(book, 'docx')
    const epub = await buildBookExport(book, 'epub')
    const docxArchive = await JSZip.loadAsync(docx.buffer)
    const epubArchive = await JSZip.loadAsync(epub.buffer)

    assert.ok(docxArchive.file('word/document.xml'))
    assert.equal(await epubArchive.file('mimetype')?.async('string'), 'application/epub+zip')
    assert.match(await epubArchive.file('OEBPS/content.opf')?.async('string') || '', /Тестовая книга/)
    assert.match(await epubArchive.file('OEBPS/chapter-1.xhtml')?.async('string') || '', /Первый абзац/)
  })
})
