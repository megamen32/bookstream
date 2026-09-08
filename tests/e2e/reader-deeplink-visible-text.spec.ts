import { expect, test, type Page } from '@playwright/test'

const DEFAULT_DEEPLINK_URL = '/alex/istoriya-anonimnogo-gosudarstva/read?chapter=cmovf6qye0039j8slwdrf659p&variant=original&mode=feed&paragraph=cmovf6qyt003jj8sluz2iy10r&startOffset=0&endOffset=305'
const TARGET_PARAGRAPH_ID = 'cmovf6qyt003jj8sluz2iy10r'
test.describe('reader deep-link visible text', () => {
  test('opens the requested quote paragraph in the viewport and does not navigate again', async ({ page }) => {
    const url = process.env.DEEPLINK_URL || DEFAULT_DEEPLINK_URL
    const pageLoads: string[] = []
    page.on('load', () => pageLoads.push(page.url()))

    await page.setViewportSize({ width: 1365, height: 900 })

    await page.addInitScript(() => localStorage.clear())

    await page.goto(url, { waitUntil: 'domcontentloaded' })

    await expect.poll(async () => page.locator(`[data-paragraph-id="${TARGET_PARAGRAPH_ID}"]`).evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    })).toBe(true)

    const loadCountAfterVisibleText = pageLoads.length

    await page.waitForTimeout(3_000)

    await expect.poll(async () => page.locator(`[data-paragraph-id="${TARGET_PARAGRAPH_ID}"]`).evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    })).toBe(true)
    expect(pageLoads.length).toBe(loadCountAfterVisibleText)
  })

  test('opens a deep chapter quote in both feed and book modes', async ({ page }) => {
    const bookResponse = await page.request.get('/api/books/istoriya-anonimnogo-gosudarstva?authorSlug=alex')
    expect(bookResponse.ok()).toBe(true)
    const book = await bookResponse.json() as {
      id: string
      chapters: Array<{ id: string; isReadable?: boolean }>
    }
    const readableChapters = book.chapters.filter((chapter) => chapter.isReadable !== false)
    const targetChapter = readableChapters[7]
    expect(targetChapter).toBeTruthy()

    const chapterResponse = await page.request.get(`/api/chapters/${targetChapter.id}?variantType=original`)
    expect(chapterResponse.ok()).toBe(true)
    const chapter = await chapterResponse.json() as {
      variant: { paragraphs: Array<{ id: string; text: string }> }
    }
    const targetParagraph = chapter.variant.paragraphs.find((paragraph) => paragraph.text.trim().length > 30)
    expect(targetParagraph).toBeTruthy()
    if (!targetParagraph) throw new Error('Expected a paragraph with enough visible text')

    const readerId = `playwright-deep-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await page.addInitScript((storedReaderId) => {
      window.localStorage.setItem('bookstream-reader-state', JSON.stringify({
        readerId: storedReaderId,
        username: 'playwright',
        readingMode: 'feed',
        accentTheme: 'sky',
        createQuoteCardsOnCopy: false,
      }))
    }, readerId)

    for (const mode of ['feed', 'book'] as const) {
      await page.goto(
        `/alex/istoriya-anonimnogo-gosudarstva/read?chapter=${targetChapter.id}&variant=original&mode=${mode}&paragraph=${targetParagraph.id}&startOffset=0&endOffset=${Math.min(targetParagraph.text.length, 36)}`,
        { waitUntil: 'domcontentloaded' },
      )

      await expect.poll(async () => page.locator(`[data-paragraph-id="${targetParagraph.id}"]`).count(), { timeout: 5_000 }).toBeGreaterThan(0)
      await expect.poll(async () => page.locator(`[data-paragraph-id="${targetParagraph.id}"]`).evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return rect.bottom > 0 && rect.top < window.innerHeight
      }), { timeout: 5_000 }).toBe(true)

      await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe(mode)
    }
  })

  test('a shared quote link without mode keeps the recipient reading preference', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bookstream-reader-state', JSON.stringify({
        readerId: `recipient-${Date.now()}`,
        username: 'recipient',
        readingMode: 'book',
        accentTheme: 'sky',
        createQuoteCardsOnCopy: false,
      }))
    })
    await page.goto('/alex/istoriya-anonimnogo-gosudarstva/read?chapter=cmovf6qye0039j8slwdrf659p&variant=original&paragraph=cmovf6qyt003jj8sluz2iy10r&startOffset=0&endOffset=305', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => new URL(page.url()).searchParams.get('mode'), { timeout: 5_000 }).toBe(null)
    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('bookstream-reader-state')
      return raw ? JSON.parse(raw).readingMode : null
    }), { timeout: 5_000 }).toBe('book')
    await expect.poll(async () => page.locator('[data-paragraph-id="cmovf6qyt003jj8sluz2iy10r"]').count(), { timeout: 5_000 }).toBeGreaterThan(0)
    await expect.poll(async () => page.locator('[data-paragraph-id="cmovf6qyt003jj8sluz2iy10r"]').evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    }), { timeout: 5_000 }).toBe(true)
  })

})
