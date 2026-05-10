import assert from 'node:assert/strict'
import { expect, test } from '@playwright/test'
import { createAdminSessionValue } from '../../src/lib/admin-auth.ts'

const BOOK_ID = 'cmovtl3x10001j8r4tl29kzrs'
const FIRST_CHAPTER_ID = 'cmovtl4nd0009j8r44oxfjxf2'
const ADMIN_READER_ID = 'cb62f926-4e29-4f50-a375-37914fb62deb'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

test.describe('admin book page', () => {
  test.use({ viewport: { width: 1440, height: 960 } })

  test('shows chapter text and keeps chapter list in the right sidebar', async ({ page, baseURL }) => {
    assert.ok(baseURL, 'playwright baseURL must be configured')

    const adminCookie = createAdminSessionValue(ADMIN_READER_ID)
    await page.context().addCookies([
      {
        name: 'bookstream_admin',
        value: adminCookie,
        domain: new URL(baseURL).hostname,
        path: '/',
      },
    ])

    const chapterResponse = await fetch(
      `${baseURL}/api/chapters/${FIRST_CHAPTER_ID}?variantType=original&includeDrafts=1`,
      {
        headers: {
          Cookie: `bookstream_admin=${adminCookie}`,
        },
      },
    )
    assert.equal(chapterResponse.ok, true, 'chapter api must respond successfully')

    const chapterPayload = (await chapterResponse.json()) as {
      chapter: { title: string }
      variant: { contentHtml: string }
    }
    const expectedChapterText = stripHtml(chapterPayload.variant.contentHtml).slice(0, 80)

    assert.ok(expectedChapterText.length > 0, 'expected chapter text should not be empty')

    await page.goto(`/admin/books/${BOOK_ID}`)

    const titleField = page.locator('textarea[aria-label="Название главы"]')
    const prose = page.locator('.bookstream-prose')
    const sidebar = page.locator('aside').filter({ hasText: 'Главы' })

    await expect(prose).toHaveCount(1)
    await expect(titleField).toHaveValue(chapterPayload.chapter.title)
    await expect(prose).toContainText(expectedChapterText)
    await expect(sidebar).toBeVisible()

    const visibleEditorText = (await prose.innerText()).trim()
    assert.ok(visibleEditorText.length > 0, 'visible editor should contain chapter text')

    const [titleBox, proseBox, sidebarBox] = await Promise.all([
      titleField.boundingBox(),
      prose.boundingBox(),
      sidebar.boundingBox(),
    ])

    assert.ok(titleBox, 'editor title field must be visible')
    assert.ok(proseBox, 'editor content must be visible')
    assert.ok(sidebarBox, 'chapter sidebar must be visible')
    assert.ok(
      sidebarBox.x > proseBox.x + proseBox.width / 2,
      `chapter sidebar should be on the right, got prose x=${proseBox.x} and sidebar x=${sidebarBox.x}`,
    )
  })
})
