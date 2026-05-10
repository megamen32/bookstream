import { expect, test } from '@playwright/test'

test.describe('feed reader interactions', () => {
  function isIgnorableDevConsoleError(message: string): boolean {
    return message.includes('/_next/webpack-hmr') && message.includes('ERR_INVALID_HTTP_RESPONSE')
  }

  test('loads background chapters without runtime errors', async ({ page }) => {
    const runtimeErrors: string[] = []

    // Treat every runtime error as a regression; the whitelist is intentionally empty.
    page.on('pageerror', (error) => {
      runtimeErrors.push(`pageerror: ${error.message}`)
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnorableDevConsoleError(msg.text())) {
        runtimeErrors.push(`console: ${msg.text()}`)
      }
    })

    await page.goto('/test/feed-reader')

    const feedReader = page.locator('.feed-reader')
    await expect(feedReader).toBeVisible()
    await expect(page.locator('[data-chapter-id="chapter-1"]')).toBeVisible()

    await feedReader.hover()
    await page.mouse.wheel(0, 1600)

    await expect(page.locator('[data-chapter-id="chapter-2"]')).toBeVisible()

    await page.waitForTimeout(150)

    expect(runtimeErrors).toEqual([])
  })

  test('scrolls inside the feed viewport', async ({ page }) => {
    await page.goto('/test/feed-reader')

    const feedReader = page.locator('.feed-reader')
    await expect(feedReader).toBeVisible()

    const beforeScrollTop = await feedReader.evaluate((node) => node.scrollTop)
    expect(beforeScrollTop).toBe(0)

    await feedReader.hover()
    await page.mouse.wheel(0, 1400)

    await expect.poll(async () => (
      await feedReader.evaluate((node) => node.scrollTop)
    )).toBeGreaterThan(100)
  })

  test('opens chrome on a regular click in feed mode', async ({ page }) => {
    await page.goto('/test/feed-reader')

    await expect(page.locator('.reader-chrome')).toHaveCount(0)

    await page.locator('.feed-reader').click({
      position: { x: 320, y: 180 },
    })

    await expect(page.locator('.reader-chrome')).toBeVisible()
    await expect(page.locator('.reader-chrome__book-title')).toHaveText('Тестовая книга')
    await expect(page.locator('.reader-chrome__chapter-title')).toHaveText('Тестовая глава')
  })

  test('focuses a quote target once and then allows free scrolling', async ({ page }) => {
    await page.goto('/test/feed-reader?chapter=chapter-3&paragraph=chapter-3-p-10&startOffset=12&endOffset=48')

    const feedReader = page.locator('.feed-reader')
    const targetParagraph = page.locator('[data-paragraph-id="chapter-3-p-10"]')
    const shell = page.locator('[data-testid="feed-reader-test-shell"]')

    await expect(feedReader).toBeVisible()
    await expect(targetParagraph).toBeVisible()
    await expect(targetParagraph.locator('.bookstream-word-highlight')).toHaveCount(1)

    const focusedScrollTop = await feedReader.evaluate((node) => node.scrollTop)
    expect(focusedScrollTop).toBeGreaterThan(150)

    await page.waitForTimeout(1300)
    await expect(targetParagraph).not.toHaveClass(/bookstream-quote-focus-pulse/)
    await expect(shell).toHaveAttribute('data-quote-focus-handled-count', '1')
    await expect(shell).toHaveAttribute('data-quote-focus-active', 'false')

    await feedReader.hover()
    await page.mouse.wheel(0, 900)

    await expect.poll(async () => (
      await feedReader.evaluate((node) => node.scrollTop)
    )).toBeGreaterThan(focusedScrollTop + 120)
  })
})
