import type { CSSProperties, ReactElement } from 'react'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { isSafeCoverFileName, resolveCoverDirectories } from './cover-storage.ts'
import { normalizeShareText, truncateShareText } from './public-sharing.ts'

interface ShareBookCardInput {
  title: string
  description: string | null
  coverUrl: string | null
  authorName: string
  slug: string
}

interface ShareMomentCardInput {
  title: string
  coverUrl: string | null
  authorName: string
  chapterTitle: string
  quoteText: string
  slug: string
}

interface CoverImageSource {
  src: string
}

interface ShareCardDimensions {
  width: number
  height: number
}

const BOOK_CARD_DIMENSIONS: ShareCardDimensions = {
  width: 1200,
  height: 630,
}

const MOMENT_CARD_DIMENSIONS: ShareCardDimensions = {
  width: 1200,
  height: 630,
}

const SLUG_PALETTES = [
  ['#0f172a', '#0f766e'],
  ['#111827', '#a16207'],
  ['#1f2937', '#7c3aed'],
  ['#0b1324', '#2563eb'],
  ['#111827', '#16a34a'],
  ['#0f172a', '#db2777'],
]

function getPalette(slug: string): [string, string] {
  let hash = 0
  for (const char of slug) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0)
    hash |= 0
  }

  return SLUG_PALETTES[Math.abs(hash) % SLUG_PALETTES.length]
}

function buildBackgroundStyle(slug: string): CSSProperties {
  const [from, to] = getPalette(slug)
  return {
    backgroundImage: [
      'radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 28%)',
      'radial-gradient(circle at 80% 20%, rgba(16,185,129,0.18), transparent 24%)',
      `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    ].join(', '),
  }
}

async function resolveCoverImageSource(coverUrl: string | null): Promise<CoverImageSource | null> {
  if (!coverUrl) {
    return null
  }

  const localSource = await resolveLocalCoverImageSource(coverUrl)
  if (localSource) {
    return localSource
  }

  return resolveRemoteCoverImageSource(coverUrl)
}

async function resolveLocalCoverImageSource(coverUrl: string): Promise<CoverImageSource | null> {
  const fileName = path.basename(coverUrl)
  if (!isSafeCoverFileName(fileName)) {
    return null
  }

  for (const coverDirectory of resolveCoverDirectories()) {
    const coverPath = path.join(coverDirectory, fileName)

    try {
      const buffer = await readFile(coverPath)
      return convertCoverBufferToDataUrl(buffer)
    } catch (error) {
      if (!isFileNotFoundError(error)) {
        throw error
      }
    }
  }

  return null
}

async function resolveRemoteCoverImageSource(coverUrl: string): Promise<CoverImageSource | null> {
  if (!/^https?:\/\//i.test(coverUrl)) {
    return null
  }

  const response = await fetch(coverUrl)
  if (!response.ok) {
    return null
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  return convertCoverBufferToDataUrl(buffer)
}

async function convertCoverBufferToDataUrl(buffer: Buffer): Promise<CoverImageSource | null> {
  try {
    const outputBuffer = await sharp(buffer, { failOnError: false })
      .rotate()
      .resize({ width: 900, height: 1350, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()

    return {
      src: `data:image/png;base64,${outputBuffer.toString('base64')}`,
    }
  } catch (error) {
    console.warn('Failed to prepare Open Graph cover image', error)
    return null
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT')
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function wrapText(text: string, maxLineLength: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return []
  }

  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (candidate.length <= maxLineLength || currentLine.length === 0) {
      currentLine = candidate
      continue
    }

    lines.push(currentLine)
    currentLine = word

    if (lines.length >= maxLines - 1) {
      break
    }
  }

  if (lines.length >= maxLines - 1) {
    const remainingWords = words.slice(lines.join(' ').split(/\s+/).filter(Boolean).length)
    const tail = [currentLine, ...remainingWords].filter(Boolean).join(' ')
    if (tail) {
      lines.push(tail)
    }
  } else if (currentLine) {
    lines.push(currentLine)
  }

  if (lines.length > maxLines) {
    lines.length = maxLines
  }

  const lastIndex = lines.length - 1
  if (lastIndex >= 0 && lines[lastIndex].length > maxLineLength) {
    lines[lastIndex] = `${lines[lastIndex].slice(0, Math.max(0, maxLineLength - 1)).trimEnd()}…`
  }

  return lines
}

function renderSvgTextLines(
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  fontSize: number,
  fill: string,
  fontWeight: number,
  letterSpacing = '-0.03em',
): string {
  if (lines.length === 0) {
    return ''
  }

  const escapedLines = lines.map((line) => escapeXml(line))
  const tspans = escapedLines.map((line, index) => (
    `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`
  )).join('')

  return `
    <text
      x="${x}"
      y="${y}"
      fill="${fill}"
      font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      font-size="${fontSize}"
      font-weight="${fontWeight}"
      letter-spacing="${letterSpacing}"
    >${tspans}</text>
  `
}

function buildShareBackground(slug: string): string {
  const [from, to] = getPalette(slug)
  return `
    <defs>
      <linearGradient id="background-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b1020" />
        <stop offset="100%" stop-color="#070b14" />
      </linearGradient>
      <linearGradient id="cover-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${from}" />
        <stop offset="100%" stop-color="${to}" />
      </linearGradient>
      <linearGradient id="cover-overlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(2,6,23,0.12)" />
        <stop offset="100%" stop-color="rgba(2,6,23,0.72)" />
      </linearGradient>
      <radialGradient id="top-left-glow" cx="0%" cy="0%" r="90%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.18)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0)" />
      </radialGradient>
      <radialGradient id="top-right-glow" cx="80%" cy="20%" r="60%">
        <stop offset="0%" stop-color="rgba(16,185,129,0.18)" />
        <stop offset="100%" stop-color="rgba(16,185,129,0)" />
      </radialGradient>
      <clipPath id="cover-clip">
        <rect x="0" y="0" width="340" height="522" rx="36" ry="36" />
      </clipPath>
    </defs>
    <rect width="${BOOK_CARD_DIMENSIONS.width}" height="${BOOK_CARD_DIMENSIONS.height}" fill="url(#background-gradient)" />
    <rect width="${BOOK_CARD_DIMENSIONS.width}" height="${BOOK_CARD_DIMENSIONS.height}" fill="url(#top-left-glow)" />
    <rect width="${BOOK_CARD_DIMENSIONS.width}" height="${BOOK_CARD_DIMENSIONS.height}" fill="url(#top-right-glow)" />
  `
}

async function buildCoverImageMarkup(coverUrl: string | null, fallbackTitle: string): Promise<string> {
  const coverImage = await resolveCoverImageSource(coverUrl)
  const backgroundRect = `
    <rect x="54" y="54" width="340" height="522" rx="36" ry="36" fill="url(#cover-gradient)" />
  `

  if (!coverImage) {
    const fallbackLines = wrapText(fallbackTitle, 16, 4)
    return `
      ${backgroundRect}
      <g transform="translate(54 54)">
        ${renderSvgTextLines(fallbackLines, 170, 232, 58, 48, '#ffffff', 700, '-0.04em')}
      </g>
    `
  }

  return `
    ${backgroundRect}
    <image
      href="${coverImage.src}"
      x="54"
      y="54"
      width="340"
      height="522"
      preserveAspectRatio="xMidYMid slice"
      clip-path="url(#cover-clip)"
    />
    <rect x="54" y="54" width="340" height="522" rx="36" ry="36" fill="url(#cover-overlay)" />
  `
}

function buildBookShareSvg(book: ShareBookCardInput, coverMarkup: string): string {
  const summary = book.description
    ? truncateShareText(normalizeShareText(book.description), 180)
    : 'Книга в Bookstream'

  const titleLines = wrapText(book.title, 18, 3)
  const summaryLines = wrapText(summary, 38, 4)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${BOOK_CARD_DIMENSIONS.width}" height="${BOOK_CARD_DIMENSIONS.height}" viewBox="0 0 ${BOOK_CARD_DIMENSIONS.width} ${BOOK_CARD_DIMENSIONS.height}">
      ${buildShareBackground(book.slug)}
      <g transform="translate(0 0)">
        ${coverMarkup}
      </g>
      <g transform="translate(0 0)">
        <rect x="440" y="132" width="170" height="48" rx="24" ry="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" />
        <text x="525" y="164" text-anchor="middle" fill="#f8fafc" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="24" letter-spacing="0.16em" text-transform="uppercase">Bookstream</text>
        ${renderSvgTextLines(titleLines, 440, 246, 74, 62, '#f8fafc', 700, '-0.04em')}
        <text x="440" y="344" fill="rgba(248, 250, 252, 0.78)" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="30"> ${escapeXml(book.authorName)}</text>
        ${renderSvgTextLines(summaryLines, 440, 418, 40, 28, 'rgba(248, 250, 252, 0.86)', 400, '0')}
      </g>
    </svg>
  `
}

function buildMomentShareSvg(moment: ShareMomentCardInput, coverMarkup: string): string {
  const quote = truncateShareText(normalizeShareText(moment.quoteText), 220)
  const titleLines = wrapText(moment.title, 18, 3)
  const quoteLines = wrapText(quote, 34, 4)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${MOMENT_CARD_DIMENSIONS.width}" height="${MOMENT_CARD_DIMENSIONS.height}" viewBox="0 0 ${MOMENT_CARD_DIMENSIONS.width} ${MOMENT_CARD_DIMENSIONS.height}">
      ${buildShareBackground(moment.slug)}
      <g transform="translate(0 0)">
        ${coverMarkup}
      </g>
      <g transform="translate(0 0)">
        <rect x="440" y="132" width="200" height="48" rx="24" ry="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" />
        <text x="540" y="164" text-anchor="middle" fill="#f8fafc" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="24" letter-spacing="0.16em" text-transform="uppercase">Цитата из книги</text>
        ${renderSvgTextLines(titleLines, 440, 246, 70, 58, '#f8fafc', 700, '-0.04em')}
        ${renderSvgTextLines(quoteLines, 440, 388, 44, 34, 'rgba(248, 250, 252, 0.9)', 400, '0')}
        <text x="440" y="506" fill="rgba(248, 250, 252, 0.76)" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="26">${escapeXml(moment.authorName)} · ${escapeXml(moment.chapterTitle)}</text>
      </g>
    </svg>
  `
}

async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer()
}

function CoverFrame({
  coverImage,
  slug,
  fallbackTitle,
}: {
  coverImage: CoverImageSource | null
  slug: string
  fallbackTitle: string
}): ReactElement {
  const backgroundStyle = buildBackgroundStyle(slug)

  if (coverImage) {
    return (
      <div
        style={{
          ...backgroundStyle,
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <img
          src={coverImage.src}
          alt=""
          width={900}
          height={1350}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(2,6,23,0.12), rgba(2,6,23,0.72))',
          }}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        ...backgroundStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '48px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          fontSize: 48,
          fontWeight: 700,
          lineHeight: 1.04,
          color: '#ffffff',
        }}
      >
        {fallbackTitle}
      </div>
    </div>
  )
}

/**
 * Renders the public book share card for Open Graph previews.
 *
 * @param book Public book information.
 * @returns JSX tree for ImageResponse.
 */
export async function renderBookShareCard(book: ShareBookCardInput): Promise<ReactElement> {
  const coverImage = await resolveCoverImageSource(book.coverUrl)
  const summary = book.description
    ? truncateShareText(normalizeShareText(book.description), 180)
    : 'Книга в Bookstream'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        backgroundColor: '#050816',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at top left, rgba(125, 211, 252, 0.18), transparent 28%), radial-gradient(circle at 85% 20%, rgba(16, 185, 129, 0.16), transparent 24%), linear-gradient(180deg, #0b1020 0%, #070b14 100%)',
        }}
      />
      <div style={{ position: 'relative', display: 'flex', width: '100%', padding: 54, gap: 44 }}>
        <div
          style={{
            width: 340,
            minWidth: 340,
            borderRadius: 36,
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(2, 6, 23, 0.45)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <CoverFrame coverImage={coverImage} slug={book.slug} fallbackTitle={book.title} />
        </div>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              fontSize: 24,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            Bookstream
          </div>
          <div
            style={{
              marginTop: 24,
              maxWidth: 780,
              fontSize: 62,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: '-0.04em',
            }}
          >
            {book.title}
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 30,
              color: 'rgba(248, 250, 252, 0.78)',
            }}
          >
            {book.authorName}
          </div>
          <div
            style={{
              marginTop: 28,
              maxWidth: 840,
              fontSize: 28,
              lineHeight: 1.4,
              color: 'rgba(248, 250, 252, 0.86)',
            }}
          >
            {summary}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders the public moment share card for Open Graph previews.
 *
 * @param moment Public moment information.
 * @returns JSX tree for ImageResponse.
 */
export async function renderMomentShareCard(moment: ShareMomentCardInput): Promise<ReactElement> {
  const coverImage = await resolveCoverImageSource(moment.coverUrl)
  const quote = truncateShareText(normalizeShareText(moment.quoteText), 220)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        backgroundColor: '#050816',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at top left, rgba(244, 114, 182, 0.18), transparent 30%), radial-gradient(circle at 84% 18%, rgba(16, 185, 129, 0.15), transparent 24%), linear-gradient(180deg, #0b1020 0%, #070b14 100%)',
        }}
      />
      <div style={{ position: 'relative', display: 'flex', width: '100%', padding: 54, gap: 44 }}>
        <div
          style={{
            width: 300,
            minWidth: 300,
            borderRadius: 36,
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(2, 6, 23, 0.45)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <CoverFrame coverImage={coverImage} slug={moment.slug} fallbackTitle={moment.title} />
        </div>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              fontSize: 24,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            Цитата из книги
          </div>
          <div
            style={{
              marginTop: 24,
              maxWidth: 820,
              fontSize: 58,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
            }}
          >
            {moment.title}
          </div>
          <div
            style={{
              marginTop: 20,
              maxWidth: 860,
              fontSize: 34,
              lineHeight: 1.48,
              color: 'rgba(248, 250, 252, 0.9)',
            }}
          >
            “{quote}”
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 26,
              color: 'rgba(248, 250, 252, 0.76)',
            }}
          >
            {moment.authorName} · {moment.chapterTitle}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders the public book share card as PNG bytes.
 *
 * The SVG/Sharp path is used instead of next/og because the runtime is stricter
 * about CSS support and tends to fail closed on harmless-looking layout details.
 *
 * @param book Public book information.
 * @returns PNG buffer ready for an HTTP response.
 */
export async function renderBookShareCardPng(book: ShareBookCardInput): Promise<Buffer> {
  const coverMarkup = await buildCoverImageMarkup(book.coverUrl, book.title)
  return svgToPng(buildBookShareSvg(book, coverMarkup))
}

/**
 * Renders the public moment share card as PNG bytes.
 *
 * @param moment Public moment information.
 * @returns PNG buffer ready for an HTTP response.
 */
export async function renderMomentShareCardPng(moment: ShareMomentCardInput): Promise<Buffer> {
  const coverMarkup = await buildCoverImageMarkup(moment.coverUrl, moment.title)
  return svgToPng(buildMomentShareSvg(moment, coverMarkup))
}
