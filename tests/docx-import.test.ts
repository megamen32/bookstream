import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { promisify } from 'node:util'
import mammoth from 'mammoth'
import { buildDocxImportOptions } from '../src/lib/docx-conversion.ts'
import { splitHtmlIntoParagraphs } from '../src/lib/file-parser.ts'

const execFileAsync = promisify(execFile)

/**
 * Creates a compact DOCX fixture that exercises the formatting contracts the
 * importer is expected to preserve.
 *
 * @returns Serialized DOCX file contents.
 */
async function createSyntheticDocxFixture(): Promise<Buffer> {
  const fixtureDirectory = await mkdtemp(path.join(tmpdir(), 'bookstream-docx-import-'))

  await writeFixtureFile(fixtureDirectory, '[Content_Types].xml', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
      <Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>
    </Types>
  `)
  await writeFixtureFile(fixtureDirectory, '_rels/.rels', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship
        Id="rId1"
        Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
        Target="word/document.xml"
      />
    </Relationships>
  `)
  await writeFixtureFile(fixtureDirectory, 'word/styles.xml', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:style w:type="paragraph" w:styleId="Heading1">
        <w:name w:val="heading 1"/>
      </w:style>
    </w:styles>
  `)
  await writeFixtureFile(fixtureDirectory, 'word/_rels/document.xml.rels', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship
        Id="rIdStyles"
        Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
        Target="styles.xml"
      />
      <Relationship
        Id="rIdComments"
        Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments"
        Target="comments.xml"
      />
      <Relationship
        Id="rIdHyperlink"
        Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
        Target="https://example.com/import-test"
        TargetMode="External"
      />
    </Relationships>
  `)
  await writeFixtureFile(fixtureDirectory, 'word/comments.xml', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:comment w:id="0" w:author="QA" w:initials="QA">
        <w:p>
          <w:r>
            <w:t>Текст аннотации</w:t>
          </w:r>
        </w:p>
      </w:comment>
    </w:comments>
  `)
  await writeFixtureFile(fixtureDirectory, 'word/document.xml', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document
      xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    >
      <w:body>
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading1"/>
          </w:pPr>
          <w:r>
            <w:t>Заголовок теста</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:t>Центрированный абзац</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:r>
            <w:rPr><w:b/></w:rPr>
            <w:t>Жирный</w:t>
          </w:r>
          <w:r>
            <w:t xml:space="preserve"> и </w:t>
          </w:r>
          <w:r>
            <w:rPr><w:i/></w:rPr>
            <w:t>курсив</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:hyperlink r:id="rIdHyperlink">
            <w:r>
              <w:t>Ссылка</w:t>
            </w:r>
          </w:hyperlink>
        </w:p>
        <w:p>
          <w:commentRangeStart w:id="0"/>
          <w:r>
            <w:t>Фрагмент с комментарием</w:t>
          </w:r>
          <w:commentRangeEnd w:id="0"/>
          <w:r>
            <w:commentReference w:id="0"/>
          </w:r>
        </w:p>
        <w:sectPr/>
      </w:body>
    </w:document>
  `)

  await execFileAsync('zip', ['-qr', 'synthetic-import.docx', '.'], { cwd: fixtureDirectory })
  return readFile(path.join(fixtureDirectory, 'synthetic-import.docx'))
}

/**
 * Writes a fixture file relative to the temporary DOCX package directory.
 *
 * @param rootDirectory Temporary package root.
 * @param relativePath Relative file path inside the package.
 * @param content XML payload to write.
 */
async function writeFixtureFile(
  rootDirectory: string,
  relativePath: string,
  content: string
): Promise<void> {
  const fullPath = path.join(rootDirectory, relativePath)
  await mkdir(path.dirname(fullPath), { recursive: true })
  await writeFile(fullPath, `${content.trim()}\n`, 'utf8')
}

describe('docx import', () => {
  it('preserves aligned paragraphs, formatting, links, headings and comments during import', async () => {
    const docxBuffer = await createSyntheticDocxFixture()
    const importedContent = await mammoth.convertToHtml(
      { buffer: docxBuffer },
      buildDocxImportOptions()
    )
    const paragraphs = splitHtmlIntoParagraphs(importedContent.value)

    assert.match(importedContent.value, /<h1>Заголовок теста<\/h1>/)
    assert.match(importedContent.value, /<p style="text-align: center;">Центрированный абзац<\/p>/)
    assert.match(importedContent.value, /<strong>Жирный<\/strong> и <em>курсив<\/em>/)
    assert.match(importedContent.value, /<a href="https:\/\/example\.com\/import-test">Ссылка<\/a>/)
    assert.match(importedContent.value, /comment-ref-0/)
    assert.match(importedContent.value, /Текст аннотации/)

    const centeredParagraph = paragraphs.find((paragraph) => paragraph.text === 'Центрированный абзац')
    assert.ok(centeredParagraph)
    assert.equal(centeredParagraph.textAlign, 'center')

    const formattedParagraph = paragraphs.find((paragraph) => paragraph.text === 'Жирный и курсив')
    assert.ok(formattedParagraph)
    assert.match(formattedParagraph.html, /<strong>Жирный<\/strong>/)
    assert.match(formattedParagraph.html, /<em>курсив<\/em>/)

    const linkParagraph = paragraphs.find((paragraph) => paragraph.text === 'Ссылка')
    assert.ok(linkParagraph)
    assert.match(linkParagraph.html, /<a href="https:\/\/example\.com\/import-test">Ссылка<\/a>/)
  })
})
