import { expect, test, type Page } from '@playwright/test'

const DEFAULT_DEEPLINK_URL = '/alex/imperiya-kniga-i-mentalitet/read?chapter=cmovtl4ry003nj8r4e1wqg1wo&variant=original&paragraph=cmovtl4se0047j8r42ct0ej42&startOffset=0&endOffset=464'
const TARGET_PARAGRAPH_ID = 'cmovtl4se0047j8r42ct0ej42'
const EXPECTED_VISIBLE_TEXT = 'Отсюда специфический имперский конформизм: подчинение без надежды на вознаграждение.'
const WRONG_INITIAL_TEXT = 'Миф о «крепкой руке» держится не на вере'

async function visibleParagraphTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-paragraph-id]'))
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        text: element.textContent?.replace(/\s+/g, ' ').trim() || '',
        visible: rect.bottom > 0 && rect.top < window.innerHeight,
      }
    })
    .filter((entry) => entry.visible)
    .map((entry) => entry.text))
}

test.describe('reader deep-link visible text', () => {
  test('opens the requested quote paragraph in the viewport and does not navigate again', async ({ page }) => {
    const url = process.env.DEEPLINK_URL || DEFAULT_DEEPLINK_URL
    const pageLoads: string[] = []
    page.on('load', () => pageLoads.push(page.url()))

    await page.setViewportSize({ width: 1365, height: 900 })

    const readerId = `playwright-reader-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await page.addInitScript((storedReaderId) => {
      window.localStorage.setItem('bookstream-reader-state', JSON.stringify({
        readerId: storedReaderId,
        username: 'playwright',
        readingMode: 'feed',
        accentTheme: 'sky',
        createQuoteCardsOnCopy: false,
      }))
    }, readerId)

    await page.goto(url, { waitUntil: 'domcontentloaded' })

    await expect.poll(async () => {
      const texts = await visibleParagraphTexts(page)
      return texts.some((text) => text.includes(EXPECTED_VISIBLE_TEXT))
    }, { timeout: 5_000 }).toBe(true)

    await expect.poll(async () => page.locator(`[data-paragraph-id="${TARGET_PARAGRAPH_ID}"]`).evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    })).toBe(true)

    const visibleTexts = await visibleParagraphTexts(page)
    expect(visibleTexts.some((text) => text.includes(WRONG_INITIAL_TEXT))).toBe(false)

    const loadCountAfterVisibleText = pageLoads.length

    await page.waitForTimeout(3_000)

    const visibleTextsAfterSettle = await visibleParagraphTexts(page)
    expect(visibleTextsAfterSettle.some((text) => text.includes(EXPECTED_VISIBLE_TEXT))).toBe(true)
    expect(visibleTextsAfterSettle.some((text) => text.includes(WRONG_INITIAL_TEXT))).toBe(false)
    expect(pageLoads.length).toBe(loadCountAfterVisibleText)
  })
})
