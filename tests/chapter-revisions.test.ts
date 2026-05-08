import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Paragraph } from '@prisma/client'
import {
  assignParagraphStableKeys,
  resolveReboundAnchorForTesting,
} from '../src/lib/chapter-revisions.ts'

function buildParagraph(id: string, stableKey: string, position: number, text: string): Paragraph {
  return {
    id,
    chapterVariantId: 'variant-1',
    stableKey,
    position,
    text,
  }
}

describe('chapter revisions', () => {
  it('preserves downstream stable keys when a paragraph is inserted before them', () => {
    const previousParagraphs = [
      buildParagraph('p1', 'sk-1', 0, 'Alpha paragraph.'),
      buildParagraph('p2', 'sk-2', 1, 'Beta paragraph.'),
    ]

    const nextParagraphs = assignParagraphStableKeys(previousParagraphs, [
      {
        stableKey: 'temp-0',
        position: 0,
        text: 'Inserted opening paragraph.',
        html: '<p>Inserted opening paragraph.</p>',
        textAlign: null,
        indentPx: 0,
      },
      {
        stableKey: 'temp-1',
        position: 1,
        text: 'Alpha paragraph.',
        html: '<p>Alpha paragraph.</p>',
        textAlign: null,
        indentPx: 0,
      },
      {
        stableKey: 'temp-2',
        position: 2,
        text: 'Beta paragraph.',
        html: '<p>Beta paragraph.</p>',
        textAlign: null,
        indentPx: 0,
      },
    ])

    assert.notEqual(nextParagraphs[0].stableKey, 'sk-1')
    assert.equal(nextParagraphs[1].stableKey, 'sk-1')
    assert.equal(nextParagraphs[2].stableKey, 'sk-2')
  })

  it('keeps the same stable key for a lightly edited paragraph', () => {
    const previousParagraphs = [
      buildParagraph('p1', 'sk-1', 0, 'The quick brown fox jumps over the lazy dog.'),
    ]

    const nextParagraphs = assignParagraphStableKeys(previousParagraphs, [
      {
        stableKey: 'temp-1',
        position: 0,
        text: 'The quick brown fox jumps over a very lazy dog.',
        html: '<p>The quick brown fox jumps over a very lazy dog.</p>',
        textAlign: null,
        indentPx: 0,
      },
    ])

    assert.equal(nextParagraphs[0].stableKey, 'sk-1')
  })

  it('rebinds an annotation exactly after a paragraph is shifted by an inserted intro', () => {
    const previousParagraphs = [
      buildParagraph('old-1', 'sk-1', 0, 'Alpha paragraph.'),
      buildParagraph('old-2', 'sk-2', 1, 'Target fragment lives here.'),
    ]
    const nextParagraphs = [
      buildParagraph('new-0', 'sk-new', 0, 'Inserted intro.'),
      buildParagraph('new-1', 'sk-1', 1, 'Alpha paragraph.'),
      buildParagraph('new-2', 'sk-2', 2, 'Target fragment lives here.'),
    ]

    const resolved = resolveReboundAnchorForTesting(
      {
        paragraphId: 'old-2',
        endParagraphId: 'old-2',
        startStableKey: 'sk-2',
        endStableKey: 'sk-2',
        selectedText: 'fragment lives',
        anchorPrefix: 'Target',
        anchorSuffix: 'here.',
        anchorStatus: 'exact',
        anchorScore: 1,
        startOffset: 7,
        endOffset: 21,
      },
      previousParagraphs,
      nextParagraphs,
    )

    assert.equal(resolved.anchorStatus, 'exact')
    assert.equal(resolved.paragraphId, 'new-2')
    assert.equal(resolved.endParagraphId, 'new-2')
  })

  it('falls back to approximate when the text changes but remains recognizable', () => {
    const previousParagraphs = [
      buildParagraph('old-1', 'sk-1', 0, 'We walked through the silent forest at dawn.'),
    ]
    const nextParagraphs = [
      buildParagraph('new-1', 'sk-1', 0, 'At dawn we walked through the quiet forest together.'),
    ]

    const resolved = resolveReboundAnchorForTesting(
      {
        paragraphId: 'old-1',
        endParagraphId: 'old-1',
        startStableKey: 'sk-1',
        endStableKey: 'sk-1',
        selectedText: 'silent forest at dawn',
        anchorPrefix: 'through the',
        anchorSuffix: null,
        anchorStatus: 'exact',
        anchorScore: 1,
        startOffset: 22,
        endOffset: 44,
      },
      previousParagraphs,
      nextParagraphs,
    )

    assert.equal(resolved.anchorStatus, 'approximate')
    assert.equal(resolved.paragraphId, 'new-1')
  })

  it('marks an annotation as stale when no chapter-local match remains', () => {
    const previousParagraphs = [
      buildParagraph('old-1', 'sk-1', 0, 'A completely removed paragraph.'),
    ]
    const nextParagraphs = [
      buildParagraph('new-1', 'sk-2', 0, 'An unrelated replacement.'),
    ]

    const resolved = resolveReboundAnchorForTesting(
      {
        paragraphId: 'old-1',
        endParagraphId: 'old-1',
        startStableKey: 'sk-1',
        endStableKey: 'sk-1',
        selectedText: 'completely removed',
        anchorPrefix: null,
        anchorSuffix: null,
        anchorStatus: 'exact',
        anchorScore: 1,
        startOffset: 2,
        endOffset: 20,
      },
      previousParagraphs,
      nextParagraphs,
    )

    assert.equal(resolved.anchorStatus, 'stale')
    assert.equal(resolved.paragraphId, null)
  })
})
