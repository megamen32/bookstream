import mammoth from 'mammoth'

type MammothOptions = NonNullable<Parameters<typeof mammoth.convertToHtml>[1]>

interface ImportedDocxIndent {
  start: string | null
  end: string | null
  firstLine: string | null
  hanging: string | null
}

interface ImportedDocxParagraph {
  type: 'paragraph'
  styleId: string | null
  styleName: string | null
  alignment: string | null
  indent: ImportedDocxIndent
  children?: unknown[]
}

type MammothWithTransforms = typeof mammoth & {
  transforms: {
    paragraph: (
      transform: (paragraph: ImportedDocxParagraph) => ImportedDocxParagraph
    ) => (element: unknown) => unknown
  }
}

const mammothWithTransforms = mammoth as MammothWithTransforms

const DOCX_ALIGNMENT_STYLE_MAP: string[] = [
  "p.AlignmentCenter => p[style='text-align: center;']:fresh",
  "p.AlignmentRight => p[style='text-align: right;']:fresh",
  "p.AlignmentJustify => p[style='text-align: justify;']:fresh",
  'comment-reference => sup',
]

/**
 * Builds the shared Mammoth options used by DOCX import flows.
 *
 * The importer keeps Mammoth's semantic defaults for styled paragraphs such as
 * headings, but restores explicit alignment for plain paragraphs like title
 * pages. Word comments are also surfaced so import regressions are testable.
 *
 * @param overrides Optional Mammoth option overrides.
 * @returns Stable conversion options for DOCX imports.
 */
export function buildDocxImportOptions(overrides: Partial<MammothOptions> = {}): MammothOptions {
  const overrideStyleMap = normalizeStyleMap(overrides.styleMap)

  return {
    ...overrides,
    styleMap: [...DOCX_ALIGNMENT_STYLE_MAP, ...overrideStyleMap],
    transformDocument: mammothWithTransforms.transforms.paragraph((paragraph) => (
      transformImportedParagraph(paragraph)
    )),
  }
}

function normalizeStyleMap(styleMap?: MammothOptions['styleMap']): string[] {
  if (!styleMap) {
    return []
  }

  return Array.isArray(styleMap) ? styleMap : [styleMap]
}

function transformImportedParagraph(paragraph: ImportedDocxParagraph): ImportedDocxParagraph {
  if (paragraph.styleId) {
    return paragraph
  }

  const alignmentStyleId = resolveAlignmentStyleId(paragraph.alignment)
  if (!alignmentStyleId) {
    return paragraph
  }

  return {
    ...paragraph,
    styleId: alignmentStyleId,
  }
}

function resolveAlignmentStyleId(alignment: string | null): string | null {
  if (alignment === 'center') return 'AlignmentCenter'
  if (alignment === 'right') return 'AlignmentRight'
  if (alignment === 'both') return 'AlignmentJustify'
  if (alignment === 'justify') return 'AlignmentJustify'
  return null
}
