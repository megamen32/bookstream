import { expect, test } from '@playwright/test'

test.describe('feed reader interactions', () => {
  test('loads background chapters without runtime errors', async ({ page }) => {
    const runtimeErrors: string[] = []

    // Treat every runtime error as a regression; the whitelist is intentionally empty.
    page.on('pageerror', (error) => {
      runtimeErrors.push(`pageerror: ${error.message}`)
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
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
})
