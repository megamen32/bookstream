import type { FeedSectionData } from './feed-types'

/**
 * Extracts image urls from chapter paragraph HTML blocks.
 */
export function extractImageUrlsFromSection(section: FeedSectionData): string[] {
  const urls: string[] = []

  for (const paragraph of section.variant.paragraphs) {
    if (!paragraph.html) {
      continue
    }

    const matches = paragraph.html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)
    for (const match of matches) {
      if (match[1]) {
        urls.push(match[1])
      }
    }
  }

  return urls
}

/**
 * Starts browser-level image preloading for nearby chapters.
 */
export function preloadSectionImages(section: FeedSectionData): void {
  for (const src of extractImageUrlsFromSection(section)) {
    const image = new Image()
    image.decoding = 'async'
    image.loading = 'eager'
    image.src = src
  }
}
