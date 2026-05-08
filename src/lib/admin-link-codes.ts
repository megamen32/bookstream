import { createHash, randomBytes } from 'crypto'
import type { AdminLinkCode } from '@prisma/client'

export const ADMIN_LINK_CODE_TTL_MS = 10 * 60 * 1000
const ADMIN_LINK_CODE_RAW_LENGTH = 8

/**
 * Builds a short one-time code for linking a new device.
 *
 * @returns Human-readable code in grouped hexadecimal format.
 */
export function createAdminLinkCode(): string {
  const raw = randomBytes(ADMIN_LINK_CODE_RAW_LENGTH).toString('hex').toUpperCase()
  return raw.match(/.{1,4}/g)?.join('-') || raw
}

/**
 * Normalizes user input so the same code can be pasted or typed with separators.
 *
 * @param code User-entered transfer code.
 * @returns Canonical uppercase code without separators.
 */
export function normalizeAdminLinkCode(code: string): string {
  return code.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
}

/**
 * Formats a raw code for display with grouped separators.
 *
 * @param rawCode Code without separators.
 * @returns Grouped code for the UI.
 */
export function formatAdminLinkCode(rawCode: string): string {
  return rawCode.match(/.{1,4}/g)?.join('-') || rawCode
}

/**
 * Hashes the canonical code for safe persistence.
 *
 * @param code Canonical code without separators.
 * @returns Stable SHA-256 hash.
 */
export function hashAdminLinkCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

/**
 * Checks whether a stored link code can still be used.
 *
 * @param linkCode Stored database row.
 * @param now Reference time for expiry checks.
 * @returns `true` when the code is active and unconsumed.
 */
export function isActiveAdminLinkCode(linkCode: Pick<AdminLinkCode, 'expiresAt' | 'usedAt' | 'revokedAt'>, now: Date = new Date()): boolean {
  return !linkCode.usedAt && !linkCode.revokedAt && linkCode.expiresAt.getTime() > now.getTime()
}

/**
 * Computes the expiry timestamp for a newly issued link code.
 *
 * @param now Reference time.
 * @returns Expiry date ten minutes in the future.
 */
export function createAdminLinkCodeExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + ADMIN_LINK_CODE_TTL_MS)
}
