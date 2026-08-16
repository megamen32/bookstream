import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { buildImportedBookPreview, readImportedBookFile, selectCoverCandidate } from '../src/lib/book-import.ts'

const execFileAsync = promisify(execFile)

async function writeFixture(root: string, relativePath: string, content: string | Buffer): Promise<void> {
  const target = path.join(root, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content)
}

async function makeImage(width: number, height: number, color: string, label: string): Promise<Buffer> {
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg = '<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="' + color + '"/><text x="24" y="' + Math.max(36, Math.floor(height / 2)) + '" font-family="Arial" font-size="28" fill="white">' + escaped + '</text></svg>'
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function createDocxFixture(options: {
  title?: string
  description?: string
  images?: Array<{ fileName: string; buffer: Buffer; alt: string; cx: number; cy: number }>
} = {}): Promise<Buffer> {
  const root = await mkdtemp(path.join(tmpdir(), 'bookstream-import-images-'))
  const images = options.images || []
  const relationships = images.map((image, index) => '<Relationship Id="rIdImage' + (index + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + image.fileName + '"/>').join('')
  const drawings = images.map((image, index) => '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="' + image.cx + '" cy="' + image.cy + '"/><wp:docPr id="' + (index + 1) + '" name="' + image.alt + '"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="' + (index + 1) + '" name="' + image.alt + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage' + (index + 1) + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + image.cx + '" cy="' + image.cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>').join('')
  await writeFixture(root, '[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>')
  await writeFixture(root, '_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>')
  await writeFixture(root, 'docProps/core.xml', '<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' + (options.title || '') + '</dc:title><dc:subject>' + (options.description || '') + '</dc:subject></cp:coreProperties>')
  await writeFixture(root, 'word/_rels/document.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + relationships + '</Relationships>')
  for (const image of images) await writeFixture(root, 'word/media/' + image.fileName, image.buffer)
  await writeFixture(root, 'word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:r><w:t>Вводный текст научной книги с достаточным объёмом для описания.</w:t></w:r></w:p>' + drawings + '<w:p><w:r><w:t>Основной текст после иллюстраций.</w:t></w:r></w:p><w:sectPr/></w:body></w:document>')
  await execFileAsync('zip', ['-qr', 'fixture.docx', '.'], { cwd: root })
  return readFile(path.join(root, 'fixture.docx'))
}

describe('synthetic import image and metadata tests', () => {
  it('uses DOCX core metadata and chooses a portrait cover over a landscape chart', async () => {
    const cover = await makeImage(600, 900, '#293b63', 'COVER')
    const chart = await makeImage(1200, 500, '#8b3a3a', 'CHART')
    const file = new File([await createDocxFixture({
      title: 'Explicit DOCX title',
      description: 'Explicit DOCX description from core properties for the preview.',
      images: [
        { fileName: 'chart.png', buffer: chart, alt: 'chart', cx: 9144000, cy: 3810000 },
        { fileName: 'cover.png', buffer: cover, alt: 'cover', cx: 4572000, cy: 6858000 },
      ],
    })], 'article.docx')
    const imported = await readImportedBookFile(file)
    assert.equal(imported.metadata.title, 'Explicit DOCX title')
    assert.equal(imported.metadata.description, 'Explicit DOCX description from core properties for the preview.')
    assert.equal(imported.imageCandidates.length, 2)
    assert.equal(imported.imageCandidates[1]?.width, 600)
    assert.equal(imported.imageCandidates[1]?.height, 900)
    assert.equal(imported.coverDataUrl, imported.imageCandidates[1]?.dataUrl)
    const preview = await buildImportedBookPreview(file)
    assert.equal(preview.title, 'Explicit DOCX title')
    assert.equal(preview.description, 'Explicit DOCX description from core properties for the preview.')
    assert.match(preview.coverDataUrl || '', /^data:image\/webp;base64,/)
  })

  it('uses the first portrait as a deterministic fallback for ambiguous images', async () => {
    const first = await makeImage(400, 700, '#264653', 'FIRST')
    const second = await makeImage(400, 700, '#e76f51', 'SECOND')
    const file = new File([await createDocxFixture({
      images: [
        { fileName: 'first.png', buffer: first, alt: 'figure one', cx: 3048000, cy: 5334000 },
        { fileName: 'second.png', buffer: second, alt: 'figure two', cx: 3048000, cy: 5334000 },
      ],
    })], 'ambiguous.docx')
    const imported = await readImportedBookFile(file)
    assert.equal(selectCoverCandidate(imported.imageCandidates)?.index, 0)
    assert.equal(imported.coverDataUrl, imported.imageCandidates[0]?.dataUrl)
  })

  it('honors Markdown frontmatter cover and excludes remote images', async () => {
    const cover = (await makeImage(500, 800, '#386641', 'MD COVER')).toString('base64')
    const markdown = '---\ntitle: Markdown book\ndescription: Markdown description explicitly supplied in frontmatter for the preview.\ncover: data:image/png;base64,' + cover + '\n---\n\n# Markdown book\n\nText.\n\n![remote](https://example.com/figure.png)'
    const file = new File([markdown], 'book.md', { type: 'text/markdown' })
    const imported = await readImportedBookFile(file)
    assert.equal(imported.imageCandidates.length, 0)
    assert.match(imported.coverDataUrl || '', /^data:image\/png;base64,/)
    const preview = await buildImportedBookPreview(file)
    assert.equal(preview.title, 'Markdown book')
    assert.equal(preview.description, 'Markdown description explicitly supplied in frontmatter for the preview.')
    assert.match(preview.coverDataUrl || '', /^data:image\/webp;base64,/)
  })

  it('uses an optional metadata suggestion and falls back on invalid AI output', async () => {
    const markdown = '# Raw title\n\nA long enough paragraph about housing finance, urban development, and the social consequences of production cycles.'
    const file = new File([markdown], 'raw.md', { type: 'text/markdown' })
    const suggested = await buildImportedBookPreview(file, {
      suggestMetadata: async (context) => {
        assert.match(context.excerpt, /Raw title/)
        return '{"title":"AI title","description":"AI description with enough detail to describe the imported text and its main subject clearly."}'
      },
    })
    assert.equal(suggested.title, 'AI title')
    assert.equal(suggested.description, 'AI description with enough detail to describe the imported text and its main subject clearly.')
    const fallback = await buildImportedBookPreview(file, { suggestMetadata: async () => 'not json' })
    assert.equal(fallback.title, 'Raw title')
    assert.match(fallback.description || '', /housing finance/)
  })

  it('returns no cover for image-free documents', async () => {
    const file = new File(['# Text only\n\nNo image is present here.'], 'text.md', { type: 'text/markdown' })
    const imported = await readImportedBookFile(file)
    assert.equal(imported.imageCandidates.length, 0)
    assert.equal(imported.coverDataUrl, null)
    assert.equal((await buildImportedBookPreview(file)).coverDataUrl, null)
  })
})
