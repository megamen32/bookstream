import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createAdminLinkCode,
  formatAdminLinkCode,
  hashAdminLinkCode,
  isActiveAdminLinkCode,
  normalizeAdminLinkCode,
} from '../src/lib/admin-link-codes.ts'

describe('admin link codes', () => {
  it('normalizes pasted codes and keeps the canonical hex form', () => {
    assert.equal(normalizeAdminLinkCode('abcd-ef12 3456-7890'), 'ABCDEF1234567890')
    assert.equal(formatAdminLinkCode('ABCDEF1234567890'), 'ABCD-EF12-3456-7890')
  })

  it('produces a stable hash for the same canonical code', () => {
    assert.equal(
      hashAdminLinkCode('ABCDEF1234567890'),
      hashAdminLinkCode('ABCDEF1234567890'),
    )
  })

  it('detects active codes only while they are unused and unexpired', () => {
    const now = new Date('2026-05-08T10:00:00.000Z')
    assert.equal(
      isActiveAdminLinkCode({
        expiresAt: new Date('2026-05-08T10:05:00.000Z'),
        usedAt: null,
        revokedAt: null,
      }, now),
      true,
    )
    assert.equal(
      isActiveAdminLinkCode({
        expiresAt: new Date('2026-05-08T09:59:59.000Z'),
        usedAt: null,
        revokedAt: null,
      }, now),
      false,
    )
  })

  it('creates a grouped one-time code', () => {
    const code = createAdminLinkCode()
    assert.match(code, /^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/)
  })
})
