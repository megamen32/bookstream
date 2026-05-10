import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { afterEach, expect, test } from '@playwright/test'
import { createAdminSessionValue } from '../../src/lib/admin-auth.ts'
import { db } from '../../src/lib/db.ts'

const APP_SETTINGS_ID = 'global'

interface TestFixture {
  readerId: string
  authorId: string
  bookId: string
  previousPublishingSetting: boolean | null
}

const activeFixtures: TestFixture[] = []

afterEach(async () => {
  const fixture = activeFixtures.pop()
  if (!fixture) {
    return
  }

  await db.$transaction([
    db.book.deleteMany({ where: { id: fixture.bookId } }),
    db.author.deleteMany({ where: { id: fixture.authorId } }),
    db.reader.deleteMany({ where: { id: fixture.readerId } }),
  ])

  if (fixture.previousPublishingSetting === null) {
    await db.appSettings.deleteMany({ where: { id: APP_SETTINGS_ID } })
    return
  }

  await db.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    update: { allowUserPublishing: fixture.previousPublishingSetting },
    create: {
      id: APP_SETTINGS_ID,
      allowUserPublishing: fixture.previousPublishingSetting,
    },
  })
})

test.describe('admin book publishing', () => {
  test.use({ viewport: { width: 1440, height: 960 } })

  test('publishes an owned draft book and shows it on the home page', async ({ page, baseURL }) => {
    assert.ok(baseURL, 'playwright baseURL must be configured')

    const previousSettings = await db.appSettings.findUnique({
      where: { id: APP_SETTINGS_ID },
      select: { allowUserPublishing: true },
    })

    const readerId = randomUUID()
    const authorId = randomUUID()
    const bookId = randomUUID()
    const bookTitle = `Published book ${bookId.slice(0, 8)}`
    const bookSlug = `published-book-${bookId.slice(0, 8)}`

    activeFixtures.push({
      readerId,
      authorId,
      bookId,
      previousPublishingSetting: previousSettings?.allowUserPublishing ?? null,
    })

    await db.reader.create({
      data: {
        id: readerId,
        currentUsername: 'Book Owner',
        loginName: `book-owner-${bookId}`,
        isMainAdmin: false,
      },
    })
    await db.author.create({
      data: {
        id: authorId,
        slug: `author-${bookId}`,
        name: 'Author Example',
        ownerReaderId: readerId,
      },
    })
    await db.book.create({
      data: {
        id: bookId,
        slug: bookSlug,
        title: bookTitle,
        description: 'Draft book description',
        authorId,
        isPublic: false,
        readingModeDefault: 'feed',
      },
    })
    await db.appSettings.upsert({
      where: { id: APP_SETTINGS_ID },
      update: { allowUserPublishing: true },
      create: { id: APP_SETTINGS_ID, allowUserPublishing: true },
    })

    const adminCookie = createAdminSessionValue(readerId)
    await page.context().addCookies([
      {
        name: 'bookstream_admin',
        value: adminCookie,
        domain: new URL(baseURL).hostname,
        path: '/',
      },
    ])

    await page.goto('/')
    await expect(page.locator('a').filter({ hasText: bookTitle })).toHaveCount(0)

    await page.goto(`/admin/books/${bookId}`)
    await page.getByRole('button', { name: 'Настройки' }).click()
    const settingsSheet = page.locator('[role="dialog"]').last()

    const visibilitySwitch = settingsSheet.getByRole('switch')
    await expect(visibilitySwitch).toHaveAttribute('aria-checked', 'false')
    await expect(settingsSheet.getByRole('button', { name: 'Сохранить' })).toBeDisabled()

    await visibilitySwitch.click()

    await expect(visibilitySwitch).toHaveAttribute('aria-checked', 'true')
    await expect(settingsSheet.getByRole('button', { name: 'Сохранить' })).toBeEnabled()

    await settingsSheet.getByRole('button', { name: 'Сохранить' }).click()
    await expect(settingsSheet).toBeHidden()

    const persistedBook = await db.book.findUnique({
      where: { id: bookId },
      select: { isPublic: true },
    })
    assert.equal(persistedBook?.isPublic, true)

    await page.goto('/')
    await expect(page.locator('a').filter({ hasText: bookTitle }).first()).toBeVisible()
  })
})
