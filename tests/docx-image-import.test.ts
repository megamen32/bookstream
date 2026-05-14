import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { promisify } from 'node:util'
import mammoth from 'mammoth'
import sharp from 'sharp'
import { persistImportedBookImage } from '../src/lib/book-import.ts'
import { buildDocxImportOptions } from '../src/lib/docx-conversion.ts'
import { splitHtmlIntoParagraphs } from '../src/lib/file-parser.ts'

const execFileAsync = promisify(execFile)
const originalPublicDir = process.env.BOOKSTREAM_PUBLIC_DIR
const OCR_TEXT = 'BOOKSTREAM OCR IMAGE'

afterEach(() => {
  process.env.BOOKSTREAM_PUBLIC_DIR = originalPublicDir
})

async function writeText(root: string, rel: string, content: string): Promise<void> {
  const full = path.join(root, rel)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, `${content.trim()}\n`, 'utf8')
}

async function writeBinary(root: string, rel: string, content: Buffer): Promise<void> {
  const full = path.join(root, rel)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, content)
}

async function createTextImagePng(text: string): Promise<Buffer> {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return sharp(Buffer.from(`<svg width="1400" height="320" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="60" y="190" font-family="DejaVu Sans, Arial, sans-serif" font-size="86" font-weight="700" fill="black">${escaped}</text></svg>`)).png().toBuffer()
}

async function createDocxWithImage(imageBuffer: Buffer): Promise<Buffer> {
  const root = await mkdtemp(path.join(tmpdir(), 'bookstream-docx-image-'))
  await writeText(root, '[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`)
  await writeText(root, '_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
  await writeText(root, 'word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/ocr-image.png"/></Relationships>`)
  await writeBinary(root, 'word/media/ocr-image.png', imageBuffer)
  await writeText(root, 'word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:r><w:t>Абзац перед картинкой</w:t></w:r></w:p><w:p><w:r><w:drawing><wp:inline><wp:extent cx="5486400" cy="1463040"/><wp:docPr id="1" name="OCR image"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="ocr-image.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="1463040"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:p><w:r><w:t>Абзац после картинки</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`)
  await execFileAsync('zip', ['-qr', 'image-import.docx', '.'], { cwd: root })
  return readFile(path.join(root, 'image-import.docx'))
}

describe('docx image import', () => {
  it('imports embedded images into reader paragraphs and keeps OCR-readable pixels', async () => {
    const publicDir = await mkdtemp(path.join(tmpdir(), 'bookstream-docx-image-public-'))
    process.env.BOOKSTREAM_PUBLIC_DIR = publicDir
    const docxBuffer = await createDocxWithImage(await createTextImagePng(OCR_TEXT))
    const imported = await mammoth.convertToHtml({ buffer: docxBuffer }, buildDocxImportOptions({
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: await persistImportedBookImage({ bookId: 'book-image-test', image }),
      })),
    }))
    const paragraphs = splitHtmlIntoParagraphs(imported.value)
    const imageParagraph = paragraphs.find((paragraph) => paragraph.html.includes('<img'))
    assert.ok(imageParagraph)
    assert.match(imageParagraph.html, /<img[^>]+src="\/uploads\/books\/book-image-test\/book-image-test-[^"]+\.png"/)
    const src = imageParagraph.html.match(/src="([^"]+)"/)?.[1]
    assert.ok(src)
    const imagePath = path.join(publicDir, src)
    const { stdout } = await execFileAsync('tesseract', [imagePath, 'stdout', '-l', 'eng', '--psm', '6'])
    assert.match(stdout.replace(/\s+/g, ' ').toUpperCase(), /BOOKSTREAM OCR IMAGE/)
  })
})
