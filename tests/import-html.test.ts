import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { flattenImportedSections, normalizeImportedHtml, splitImportedHtmlIntoSections } from '../src/lib/imported-book-html.ts'
import { persistImportedBookImage } from '../src/lib/book-import.ts'
import { splitHtmlIntoParagraphs } from '../src/lib/file-parser.ts'

const execFileAsync = promisify(execFile)
const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZrU0AAAAASUVORK5CYII='

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
    assert.deepEqual(flattened.map((section) => section.title), ['Book 1', 'Chapter 1'])
  })

  it('keeps imported TOC links reachable after splitting headings into chapters', () => {
    const html = normalizeImportedHtml(`
      <h1>Книга 1</h1>
      <p><a href="#Глава 1">Перейти к первой главе</a></p>
      <h2>Глава 1</h2>
      <p>Текст первой главы.</p>
      <h2>Глава 2</h2>
      <p>Текст второй главы.</p>
    `)

    const sections = flattenImportedSections(splitImportedHtmlIntoSections(html, 'Fallback'))
    const firstChapter = sections.find((section) => section.title === 'Глава 1')

    assert.ok(firstChapter, 'first chapter should exist')
    assert.match(html, /href="#glava-1"/)
    assert.match(firstChapter.contentHtml, /id="glava-1"/)

    const paragraphs = splitHtmlIntoParagraphs(firstChapter.contentHtml)
    assert.match(paragraphs[0]?.html || '', /id="glava-1"/)
  })

  it('persists DOCX images as public book assets', async () => {
    const publicDir = await mkdtemp(path.join(tmpdir(), 'bookstream-assets-'))
    const previousPublicDir = process.env.BOOKSTREAM_PUBLIC_DIR
    process.env.BOOKSTREAM_PUBLIC_DIR = publicDir

    try {
      const image = {
        contentType: 'image/png',
        read: async (format: 'base64') => {
          assert.equal(format, 'base64')
          return SAMPLE_PNG_BASE64
        },
      }

      const publicUrl = await persistImportedBookImage({ bookId: 'book-123', image })
      assert.match(publicUrl, /^\/uploads\/books\/book-123\/book-123-[a-f0-9-]+\.png$/)

      const fileName = path.basename(publicUrl)
      const savedPath = path.join(publicDir, 'uploads', 'books', 'book-123', fileName)
      const savedBuffer = await readFile(savedPath)
      assert.equal(savedBuffer.toString('base64'), SAMPLE_PNG_BASE64)
    } finally {
      process.env.BOOKSTREAM_PUBLIC_DIR = previousPublicDir
    }
  })

  it('keeps DOCX image assets readable in imported chapter paragraphs and OCR-verifiable on disk', async () => {
    const publicDir = await mkdtemp(path.join(tmpdir(), 'bookstream-image-ocr-'))
    const previousPublicDir = process.env.BOOKSTREAM_PUBLIC_DIR
    process.env.BOOKSTREAM_PUBLIC_DIR = publicDir

    try {
      const expectedText = 'BOOKSTREAM IMAGE OCR 7391'
      const imageBuffer = await sharp(Buffer.from(`
        <svg width="1200" height="320" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="white"/>
          <text x="60" y="190" font-size="72" font-family="Arial, DejaVu Sans, sans-serif" font-weight="700" fill="black">${expectedText}</text>
        </svg>
      `)).png().toBuffer()

      const publicUrl = await persistImportedBookImage({
        bookId: 'book-ocr-123',
        image: {
          contentType: 'image/png',
          read: async (format: 'base64') => {
            assert.equal(format, 'base64')
            return imageBuffer.toString('base64')
          },
        },
      })

      const html = normalizeImportedHtml(`
        <h1>Книга с картинкой</h1>
        <h2>Глава с картинкой</h2>
        <p>Перед картинкой <img src="${publicUrl}" alt="${expectedText}"/> после картинки.</p>
      `)
      const sections = flattenImportedSections(splitImportedHtmlIntoSections(html, 'Fallback'))
      const imageChapter = sections.find((section) => section.title === 'Глава с картинкой')
      assert.ok(imageChapter, 'image chapter should exist')

      const paragraphs = splitHtmlIntoParagraphs(imageChapter.contentHtml)
      assert.equal(paragraphs.length, 1)
      assert.match(paragraphs[0].html, /<img\s+[^>]*src="\/uploads\/books\/book-ocr-123\//)
      assert.match(paragraphs[0].html, new RegExp(`alt="${expectedText}"`))

      const fileName = path.basename(publicUrl)
      const savedPath = path.join(publicDir, 'uploads', 'books', 'book-ocr-123', fileName)
      const savedBuffer = await readFile(savedPath)
      assert.equal(savedBuffer.toString('base64'), imageBuffer.toString('base64'))

      const { stdout } = await execFileAsync('tesseract', [savedPath, 'stdout', '-l', 'eng', '--psm', '6'], { timeout: 10_000 })
      assert.match(stdout.replace(/\s+/g, ' '), /BOOKSTREAM IMAGE OCR 7391/)
    } finally {
      process.env.BOOKSTREAM_PUBLIC_DIR = previousPublicDir
    }
  })
})
