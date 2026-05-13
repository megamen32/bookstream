import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { flattenImportedSections, normalizeImportedHtml, splitImportedHtmlIntoSections } from '../src/lib/imported-book-html.ts'
import { persistImportedBookImage } from '../src/lib/book-import.ts'

const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZrU0AAAAASUVORK5CYII='

const originalPublicDir = process.env.BOOKSTREAM_PUBLIC_DIR

afterEach(() => {
  process.env.BOOKSTREAM_PUBLIC_DIR = originalPublicDir
})

describe('imported html normalization', () => {
  it('builds nested sections and preserves internal fragment links', () => {
    const html = normalizeImportedHtml(`
      <h1>Book 1</h1>
      <p><a href="#Chapter 1">Jump</a></p>
      <h2>Chapter 1</h2>
      <p>Readable text</p>
    `)

    assert.match(html, /<a href="#chapter-1">Jump<\/a>/)
    assert.match(html, /<h1 id="book-1">Book 1<\/h1>/)

    const sections = splitImportedHtmlIntoSections(html, 'Fallback')
    assert.equal(sections.length, 1)
    assert.equal(sections[0].title, 'Book 1')
    assert.equal(sections[0].isReadable, true)
    assert.equal(sections[0].children.length, 1)
    assert.equal(sections[0].children[0].title, 'Chapter 1')
    assert.equal(sections[0].children[0].isReadable, true)

    const containerSections = splitImportedHtmlIntoSections(
      normalizeImportedHtml(`
        <h1>Book 2</h1>
        <h2>Chapter 1</h2>
        <p>Readable text</p>
      `),
      'Fallback',
    )

    assert.equal(containerSections[0].isReadable, false)
    assert.equal(containerSections[0].children[0].isReadable, true)

    const flattened = flattenImportedSections(sections)
    assert.deepEqual(
      flattened.map((section) => section.title),
      ['Book 1', 'Chapter 1'],
    )
  })

  it('persists DOCX images as public book assets', async () => {
    const publicDir = await mkdtemp(path.join(tmpdir(), 'bookstream-assets-'))
    process.env.BOOKSTREAM_PUBLIC_DIR = publicDir

    const image = {
      contentType: 'image/png',
      read: async (format: 'base64') => {
        assert.equal(format, 'base64')
        return SAMPLE_PNG_BASE64
      },
    }

    const publicUrl = await persistImportedBookImage({
      bookId: 'book-123',
      image,
    })

    assert.match(publicUrl, /^\/uploads\/books\/book-123\/book-123-[a-f0-9-]+\.png$/)

    const fileName = path.basename(publicUrl)
    const savedPath = path.join(publicDir, 'uploads', 'books', 'book-123', fileName)
    const savedBuffer = await readFile(savedPath)
    assert.equal(savedBuffer.toString('base64'), SAMPLE_PNG_BASE64)
  })
})
