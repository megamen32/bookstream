import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { promisify } from 'node:util'
import mammoth from 'mammoth'
import sharp from 'sharp'
import { persistImportedBookImage, readImportedBookFile } from '../src/lib/book-import.ts'
import { buildParagraphInputsFromHtml } from '../src/lib/chapter-variants.ts'
import { flattenImportedSections, splitImportedHtmlIntoSections } from '../src/lib/imported-book-html.ts'

const execFileAsync = promisify(execFile)
const originalPublicDir = process.env.BOOKSTREAM_PUBLIC_DIR
const OCR_TEXT = 'BOOKSTREAM OCR 7421'

afterEach(() => {
  process.env.BOOKSTREAM_PUBLIC_DIR = originalPublicDir
})

async function writeFixtureFile(root: string, relativePath: string, content: string | Buffer): Promise<void> {
  const fullPath = path.join(root, relativePath)
  await mkdir(path.dirname(fullPath), { recursive: true })
  await writeFile(fullPath, typeof content === 'string' ? `${content.trim()}\n` : content)
}

async function createTextImagePng(): Promise<Buffer> {
  const svg = `<svg width="900" height="260" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    <text x="40" y="150" font-family="DejaVu Sans, Arial" font-size="64" fill="black">${OCR_TEXT}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function createDocxWithImage(): Promise<Buffer> {
  const root = await mkdtemp(path.join(tmpdir(), 'bookstream-docx-image-'))
  await writeFixtureFile(root, '[Content_Types].xml', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Default Extension="png" ContentType="image/png"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
    </Types>
  `)
  await writeFixtureFile(root, '_rels/.rels', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>
  `)
  await writeFixtureFile(root, 'word/styles.xml', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
    </w:styles>
  `)
  await writeFixtureFile(root, 'word/_rels/document.xml.rels', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
      <Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
    </Relationships>
  `)
  await writeFixtureFile(root, 'word/media/image1.png', await createTextImagePng())
  await writeFixtureFile(root, 'word/document.xml', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <w:body>
        <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Image Chapter</w:t></w:r></w:p>
        <w:p><w:r><w:drawing><wp:inline><wp:extent cx="5486400" cy="1584960"/><wp:docPr id="1" name="OCR image" descr="${OCR_TEXT}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="image1.png" descr="${OCR_TEXT}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="1584960"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
        <w:sectPr/>
      </w:body>
    </w:document>
  `)
  await execFileAsync('zip', ['-qr', 'image-import.docx', '.'], { cwd: root })
  return readFile(path.join(root, 'image-import.docx'))
}

describe('docx image import', () => {
  it('keeps DOCX images in reader paragraphs and preserves OCR-readable image bytes', async () => {
    const publicDir = await mkdtemp(path.join(tmpdir(), 'bookstream-public-images-'))
    process.env.BOOKSTREAM_PUBLIC_DIR = publicDir
    const file = new File([await createDocxWithImage()], 'image-import.docx')

    const imported = await readImportedBookFile(file, {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: await persistImportedBookImage({ bookId: 'book-image-test', image }),
      })),
    })
    const sections = flattenImportedSections(splitImportedHtmlIntoSections(imported.html, 'Fallback'))
    const imageChapter = sections.find((section) => section.title === 'Image Chapter')

    assert.ok(imageChapter)
    assert.match(imageChapter.contentHtml, /<img[^>]+src="\/uploads\/books\/book-image-test\//)

    const paragraphs = buildParagraphInputsFromHtml(imageChapter.contentHtml)
    const imageParagraph = paragraphs.find((paragraph) => /<img\b/i.test(paragraph.html))
    assert.ok(imageParagraph, 'reader paragraph should retain imported image html')

    const imageSrc = imageParagraph.html.match(/src="([^"]+)"/)?.[1]
    assert.ok(imageSrc)
    const imagePath = path.join(publicDir, imageSrc.replace(/^\//, ''))
    const { stdout } = await execFileAsync('tesseract', [imagePath, 'stdout', '-l', 'eng', '--psm', '6'], { timeout: 10_000 })
    assert.match(stdout.replace(/\s+/g, ' '), /BOOKSTREAM OCR 7421/)
  })
})
