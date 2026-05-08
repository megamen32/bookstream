export interface EstimateChapterHeightInput {
  estimatedChars: number
  paragraphCount: number
  fontSize: number
  lineHeight: number
  lineWidth: 'narrow' | 'medium' | 'wide'
  hasCommentsAfterChapter: boolean
  hasImages?: boolean
}

/**
 * Estimates chapter height before its content is mounted.
 */
export function estimateChapterHeight(input: EstimateChapterHeightInput): number {
  const widthChars = input.lineWidth === 'narrow'
    ? 52
    : input.lineWidth === 'medium'
      ? 68
      : 84
  const lines = Math.ceil(Math.max(input.estimatedChars, 1) / widthChars)
  const textHeight = lines * input.fontSize * input.lineHeight
  const paragraphGaps = Math.max(input.paragraphCount, 1) * input.fontSize * 0.85
  const chapterHeader = 220
  const chapterAfterword = input.hasCommentsAfterChapter ? 520 : 220
  const imageAllowance = input.hasImages ? 420 : 0
  const safety = 1.12

  return Math.ceil((chapterHeader + textHeight + paragraphGaps + chapterAfterword + imageAllowance) * safety)
}
