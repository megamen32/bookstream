import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildBookExport } from '../src/lib/book-export.ts'
import { readImportedBookFile } from '../src/lib/book-import.ts'
import { flattenImportedSections, splitImportedHtmlIntoSections } from '../src/lib/imported-book-html.ts'
import { buildParagraphInputsFromHtml } from '../src/lib/chapter-variants.ts'

describe('Markdown table import and export', () => {
  it('keeps a Markdown table as one reader block and exports it as a table', async () => {
    const source = `# Рынок AI

## Приоритеты

| Ниша | Приоритет |
| --- | --- |
| Agentic QA | A |
| AI Evals | A+ |
`
    const imported = await readImportedBookFile(new File([source], 'ai-market.md', { type: 'text/markdown' }))
    const chapter = flattenImportedSections(splitImportedHtmlIntoSections(imported.html, 'Рынок AI'))
      .find((section) => section.title === 'Приоритеты')

    assert.ok(chapter)

    const readerBlocks = buildParagraphInputsFromHtml(chapter.contentHtml)
    assert.equal(readerBlocks.length, 1)
    assert.match(readerBlocks[0]?.html || '', /<table>/)

    const exported = await buildBookExport({
      title: 'Рынок AI',
      authorName: 'ChatGPT',
      description: null,
      chapters: [{ title: chapter.title, contentHtml: chapter.contentHtml }],
    }, 'md')

    assert.match(exported.buffer.toString('utf8'), /\| Ниша \| Приоритет \|/)
    assert.match(exported.buffer.toString('utf8'), /\| Agentic QA \| A \|/)
    assert.match(exported.buffer.toString('utf8'), /\| AI Evals \| A\+ \|/)
  })
})
