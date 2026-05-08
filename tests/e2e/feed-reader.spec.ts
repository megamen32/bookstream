import { expect, test } from '@playwright/test'

test.describe('feed reader interactions', () => {
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
