import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { syncVariantParagraphs } from '../src/lib/chapter-variants.ts'

describe('chapter variant paragraph synchronization', () => {
  it('replaces obsolete positions before creating a structurally new block', async () => {
    const rows = [
      { id: 'old-1', chapterVariantId: 'variant-1', stableKey: 'old-1', position: 0, text: 'Old first cell' },
      { id: 'old-2', chapterVariantId: 'variant-1', stableKey: 'old-2', position: 1, text: 'Old second cell' },
    ]

    const store = {
      paragraph: {
        findMany: async () => [...rows].sort((left, right) => left.position - right.position),
        update: async ({ where, data }: { where: { id: string }, data: Partial<(typeof rows)[number]> }) => {
          const row = rows.find((entry) => entry.id === where.id)
          if (!row) throw new Error('Paragraph not found')
          if (data.position !== undefined && rows.some((entry) => entry.id !== row.id && entry.position === data.position)) {
            throw new Error('Unique position conflict')
          }
          Object.assign(row, data)
          return row
        },
        create: async ({ data }: { data: Omit<(typeof rows)[number], 'id'> }) => {
          if (rows.some((entry) => entry.chapterVariantId === data.chapterVariantId && entry.position === data.position)) {
            throw new Error('Unique position conflict')
          }
          const row = { id: `new-${rows.length + 1}`, ...data }
          rows.push(row)
          return row
        },
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          for (const id of where.id.in) {
            const index = rows.findIndex((entry) => entry.id === id)
            if (index >= 0) rows.splice(index, 1)
          }
          return { count: where.id.in.length }
        },
      },
    }

    const synced = await syncVariantParagraphs(store as never, 'variant-1', [{
      stableKey: 'table-1',
      position: 0,
      text: 'Agentic QA A+',
      html: '<table><tr><td>Agentic QA</td><td>A+</td></tr></table>',
      textAlign: null,
      indentPx: 0,
    }])

    assert.deepEqual(synced.map((paragraph) => ({ position: paragraph.position, text: paragraph.text })), [
      { position: 0, text: 'Agentic QA A+' },
    ])
  })
})
