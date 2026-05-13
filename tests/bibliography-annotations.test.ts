import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectBibliography, parseBibliographicMarker, transformBibliographicAnnotations } from '../src/lib/books/annotations/index.ts'

describe('parseBibliographicMarker', () => {
  it('parses single items and ranges', () => {
    assert.deepEqual(parseBibliographicMarker('[1]'), [1])
    assert.deepEqual(parseBibliographicMarker('[1,14]'), [1, 14])
    assert.deepEqual(parseBibliographicMarker('[1, 14]'), [1, 14])
    assert.deepEqual(parseBibliographicMarker('[1-4]'), [1, 2, 3, 4])
    assert.deepEqual(parseBibliographicMarker('[1–4]'), [1, 2, 3, 4])
    assert.deepEqual(parseBibliographicMarker('[1—4]'), [1, 2, 3, 4])
    assert.deepEqual(parseBibliographicMarker('[1, 3-5, 14]'), [1, 3, 4, 5, 14])
    assert.deepEqual(parseBibliographicMarker('[4-1]'), [1, 2, 3, 4])
  })

  it('deduplicates and ignores malformed values', () => {
    assert.deepEqual(parseBibliographicMarker('[1, 1, 2]'), [1, 2])
    assert.deepEqual(parseBibliographicMarker('[abc]'), [])
    assert.deepEqual(parseBibliographicMarker('[1, abc, 3]'), [1, 3])
  })
})

describe('detectBibliography', () => {
  it('detects a Russian heading and multiline items', () => {
    const html = `
      <h2>Литература</h2>
      <p>1. Kahn O. Molecular Magnetism.<br>New York: VCH Publishers, 1993. 380 p.</p>
      <p>2. Gütlich P., Goodwin H.A. Spin Crossover in Transition Metal Compounds I-III.</p>
      <p>3. Halcrow M.A. Spin-Crossover Materials: Properties and Applications.</p>
      <p>4. Bousseksou A., Molnár G., Salmon L., Nicolazzi W. Molecular spin crossover phenomenon.</p>
    `

    const result = detectBibliography(html)

    assert.equal(result.confidence, 'heading')
    assert.equal(result.items.length, 4)
    assert.equal(result.items[0]?.number, 1)
    assert.match(result.items[0]?.rawText || '', /Molecular Magnetism/)
    assert.match(result.items[0]?.rawText || '', /VCH Publishers/)
  })

  it('detects a bibliography tail without a heading', () => {
    const html = `
      <p>В середине главы есть обычный абзац.</p>
      <p>1. Kahn O. Molecular Magnetism. New York: VCH Publishers, 1993. 380 p.</p>
      <p>2. Gütlich P., Goodwin H.A. Spin Crossover in Transition Metal Compounds I-III. Berlin: Springer, 2004.</p>
      <p>3. Halcrow M.A. Spin-Crossover Materials: Properties and Applications. Chichester: John Wiley & Sons, 2013.</p>
    `

    const result = detectBibliography(html)

    assert.equal(result.confidence, 'tail-heuristic')
    assert.equal(result.items.length, 3)
    assert.equal(result.items[2]?.number, 3)
  })

  it('does not classify a numbered list in the middle of the chapter as bibliography', () => {
    const html = `
      <p>Список в середине главы:</p>
      <p>1. Первый пункт.</p>
      <p>2. Второй пункт.</p>
      <p>3. Третий пункт.</p>
      <p>После списка идет обычный текст главы.</p>
    `

    const result = detectBibliography(html)

    assert.equal(result.confidence, 'none')
    assert.equal(result.items.length, 0)
  })
})

describe('transformBibliographicAnnotations', () => {
  it('wraps markers and removes bibliography tail while preserving links and code blocks', () => {
    const html = `
      <p>См. работы [1], [2-4] и <a href="/x">[5]</a>.</p>
      <pre>[6]</pre>
      <p><code>[7]</code> [1, 3-4]</p>
      <h2>Литература</h2>
      <p>1. Kahn O. Molecular Magnetism. New York: VCH Publishers, 1993. 380 p.</p>
      <p>2. Gütlich P., Goodwin H.A. Spin Crossover in Transition Metal Compounds I-III. Berlin: Springer, 2004.</p>
      <p>3. Halcrow M.A. Spin-Crossover Materials: Properties and Applications. Chichester: John Wiley & Sons, 2013.</p>
      <p>4. Bousseksou A., Molnár G., Salmon L., Nicolazzi W. Molecular spin crossover phenomenon.</p>
    `

    const result = transformBibliographicAnnotations(html)

    assert.equal(result.diagnostics.bibliographyDetected, true)
    assert.equal(result.diagnostics.bibliographyItemsCount, 4)
    assert.ok(result.html.includes('book-bibliography-marker'))
    assert.ok(result.html.includes('data-bibliography-items="1"'))
    assert.ok(result.html.includes('data-bibliography-items="2,3,4"'))
    assert.ok(result.html.includes('<a href="/x">[5]</a>'))
    assert.ok(result.html.includes('<pre>[6]</pre>'))
    assert.ok(result.html.includes('<code>[7]</code>'))
    assert.ok(!result.html.includes('Molecular spin crossover phenomenon.</p>'))
    assert.equal(result.annotations.length, 3)
  })

  it('keeps plain text unchanged when bibliography is not detected', () => {
    const html = '<p>Обычный текст [1] без списка литературы.</p>'

    const result = transformBibliographicAnnotations(html)

    assert.equal(result.diagnostics.bibliographyDetected, false)
    assert.equal(result.html, html)
    assert.equal(result.annotations.length, 0)
  })
})

