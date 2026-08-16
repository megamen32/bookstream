import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { promisify } from 'node:util'
import { buildImportedBookPreview, readImportedBookFile } from '../src/lib/book-import.ts'
import { flattenImportedSections, normalizeImportedHtml, splitImportedHtmlIntoSections } from '../src/lib/imported-book-html.ts'

const execFileAsync = promisify(execFile)

async function writeFixture(root: string, relativePath: string, content: string | Buffer): Promise<void> {
  const target = path.join(root, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content)
}

async function createDocxFixture(): Promise<Buffer> {
  const root = await mkdtemp(path.join(tmpdir(), 'bookstream-format-pipeline-'))
  await writeFixture(root, '[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`)
  await writeFixture(root, '_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
  await writeFixture(root, 'word/styles.xml', `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style></w:styles>`)
  await writeFixture(root, 'word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Форматная книга</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Глава 1</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Жирный</w:t></w:r><w:r><w:t xml:space="preserve"> и </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>курсивный</w:t></w:r></w:p><w:p><w:r><w:t>Текст со </w:t></w:r><w:hyperlink r:id="rIdLink"><w:r><w:t>ссылкой</w:t></w:r></w:hyperlink></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Глава 2</w:t></w:r></w:p><w:p><w:r><w:t>Вторая глава.</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`)
  await writeFixture(root, 'word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/format" TargetMode="External"/><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
  await execFileAsync('zip', ['-qr', 'format-pipeline.docx', '.'], { cwd: root })
  return readFile(path.join(root, 'format-pipeline.docx'))
}

async function createPlainDocxFixture(): Promise<Buffer> {
  const root = await mkdtemp(path.join(tmpdir(), 'bookstream-plain-docx-'))
  await writeFixture(root, '[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`)
  await writeFixture(root, '_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
  await writeFixture(root, 'word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Абзац без заголовка.</w:t></w:r></w:p><w:p><w:r><w:t>Второй абзац.</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`)
  await execFileAsync('zip', ['-qr', 'plain.docx', '.'], { cwd: root })
  return readFile(path.join(root, 'plain.docx'))
}

async function assertReadableSections(file: File, expectedTitles: string[]): Promise<string> {
  const imported = await readImportedBookFile(file)
  assert.ok(imported.text.length > 0)
  assert.ok(imported.html.length > 0)
  const sections = flattenImportedSections(splitImportedHtmlIntoSections(imported.html, 'Fallback'))
  const readable = sections.filter((section) => section.isReadable)
  assert.deepEqual(readable.map((section) => section.title), expectedTitles)
  for (const section of readable) {
    assert.ok(section.contentHtml.trim().length > 0, `section ${section.title} should contain HTML`)
    assert.doesNotMatch(section.contentHtml, /<script|<style/i)
  }
  return imported.html
}

describe('import format pipeline', () => {
  it('imports Markdown with headings, lists, quotes, code, tables, links and frontmatter', async () => {
    const markdown = `---\ntitle: Pipeline Markdown\ndescription: A metadata description\n---\n\n# Pipeline Markdown\n\nIntro paragraph with **bold**, *italic*, [a link](https://example.com).\n\n## Chapter One\n\n- first item\n- second item\n\n> A block quote.\n\n\`\`\`ts\nconst answer = 42\n\`\`\`\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n## Chapter Two\n\nSecond chapter text.`
    const html = await assertReadableSections(new File([markdown], 'pipeline.md', { type: 'text/markdown' }), [
      'Pipeline Markdown',
      'Chapter One',
      'Chapter Two',
    ])
    assert.match(html, /<strong>bold<\/strong>/)
    assert.match(html, /<em>italic<\/em>/)
    assert.match(html, /<blockquote>/)
    assert.match(html, /<pre><code class="language-ts">/)
    assert.match(html, /<table>/)
    assert.match(html, /target="_blank"/)
  })

  it('imports Markdown without headings as one readable chapter', async () => {
    const markdown = '# Not a chapter title?\n\nPlain text with <unsafe> literal-looking markup.\n\nSecond paragraph.'
    const imported = await readImportedBookFile(new File([markdown], 'plain.md', { type: 'text/markdown' }))
    const sections = flattenImportedSections(splitImportedHtmlIntoSections(imported.html, 'Plain Book'))
    assert.equal(sections.length, 1)
    assert.equal(sections[0]?.title, 'Not a chapter title?')
    assert.equal(sections[0]?.isReadable, true)
    assert.doesNotMatch(imported.html, /<unsafe>/)
    assert.match(imported.html, /literal-looking markup\.<\/p>/)
  })

  it('imports Markdown with raw HTML and removes executable nodes after normalization', async () => {
    const markdown = '# Safe HTML\n\n<div><p>Visible</p></div>\n\n<script>alert(1)</script>\n\n<img src="https://example.com/cover.png" alt="Cover">'
    const imported = await readImportedBookFile(new File([markdown], 'raw-html.md', { type: 'text/markdown' }))
    const normalized = normalizeImportedHtml(imported.html)
    assert.match(normalized, /Visible/)
    assert.match(normalized, /<img[^>]+src="https:\/\/example\.com\/cover\.png"/)
    assert.doesNotMatch(normalized, /<script/i)
  })

  it('imports DOCX through the same reader pipeline and preserves formatting and links', async () => {
    const html = await assertReadableSections(new File([await createDocxFixture()], 'format-pipeline.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }), ['Глава 1', 'Глава 2'])
    assert.match(html, /<strong>Жирный<\/strong> и <em>курсивный<\/em>/)
    assert.match(html, /Текст со ссылкой/)
  })

  it('imports a DOCX without headings as one readable fallback section', async () => {
    const imported = await readImportedBookFile(new File([await createPlainDocxFixture()], 'plain.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }))
    const sections = flattenImportedSections(splitImportedHtmlIntoSections(imported.html, 'Plain DOCX'))
    assert.equal(sections.length, 1)
    assert.equal(sections[0]?.title, 'Plain DOCX')
    assert.equal(sections[0]?.isReadable, true)
    assert.match(sections[0]?.contentHtml || '', /Абзац без заголовка/)
  })

  it('uses Markdown frontmatter for preview metadata without importing it as book content', async () => {
    const file = new File([
      '---\ntitle: Preview title\ndescription: Preview description with enough words to be useful\n---\n\n# Content heading\n\nReadable content.',
    ], 'preview.md', { type: 'text/markdown' })
    const preview = await buildImportedBookPreview(file)
    assert.equal(preview.title, 'Preview title')
    assert.equal(preview.description, 'Preview description with enough words to be useful')
    const imported = await readImportedBookFile(file)
    assert.doesNotMatch(imported.html, /Preview description/)
    assert.match(imported.html, /Content heading/)
  })

  it('keeps a Markdown document with unicode, escaped punctuation and empty sections importable', async () => {
    const markdown = '# Книга \u2014 тест\n\n## Пустая глава\n\n## Заполненная глава\n\nТекст: 2 < 3, 5 > 4, & сохранены.'
    const imported = await readImportedBookFile(new File([markdown], 'unicode.md', { type: 'text/markdown' }))
    const sections = flattenImportedSections(splitImportedHtmlIntoSections(imported.html, 'Fallback'))
    assert.deepEqual(sections.map((section) => ({ title: section.title, readable: section.isReadable })), [
      { title: 'Книга — тест', readable: false },
      { title: 'Пустая глава', readable: false },
      { title: 'Заполненная глава', readable: true },
    ])
    assert.match(imported.text, /2 < 3, 5 > 4, & сохранены/)
  })
})
