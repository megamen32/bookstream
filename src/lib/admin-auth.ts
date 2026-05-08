import { createHmac, timingSafeEqual } from 'crypto'
import type { Reader } from '@prisma/client'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const ADMIN_COOKIE_NAME = 'bookstream_admin'
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7

export interface AdminSessionReader {
  id: string
  currentUsername: string
  loginName: string
  isMainAdmin: boolean
}

/**
 * Returns the signed session cookie lifetime in seconds.
 *
 * @returns Cookie max-age.
 */
export function getAdminSessionMaxAge(): number {
  return ADMIN_SESSION_MAX_AGE
}

/**
 * Returns cookie flags for admin session cookies.
 *
 * @returns Cookie options shared by login and logout handlers.
 */
export function getAdminSessionCookieOptions(): {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  }
}

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'bookstream-dev-session-secret'
}

function signReaderId(readerId: string): string {
  return createHmac('sha256', getSessionSecret()).update(readerId).digest('hex')
}

/**
 * Builds a signed cookie value for the given reader id.
 *
 * @param readerId Authenticated reader id.
 * @returns Signed cookie payload.
 */
export function createAdminSessionValue(readerId: string): string {
  return `${readerId}.${signReaderId(readerId)}`
}

/**
 * Reads and verifies the authenticated reader id from the request cookie.
 *
 * @param request Incoming request.
 * @returns Reader id when the cookie is valid, otherwise `null`.
 */
export function getAuthenticatedReaderId(request: NextRequest): string | null {
  const raw = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!raw) {
    return null
  }

  const separatorIndex = raw.lastIndexOf('.')
  if (separatorIndex <= 0) {
    return null
  }

  const readerId = raw.slice(0, separatorIndex)
  const signature = raw.slice(separatorIndex + 1)
  const expectedSignature = signReaderId(readerId)

  const actualBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  if (actualBuffer.length !== expectedBuffer.length) {
    return null
  }

  return timingSafeEqual(actualBuffer, expectedBuffer) ? readerId : null
}

/**
 * Loads the authenticated admin reader from the cookie-backed session.
 *
 * @param request Incoming request.
 * @returns Authenticated reader or `null` when the session is missing or stale.
 */
export async function getAdminSessionReader(request: NextRequest): Promise<AdminSessionReader | null> {
  const readerId = getAuthenticatedReaderId(request)
  if (!readerId) {
    return null
  }

  const reader = await db.reader.findUnique({
    where: { id: readerId },
    select: {
      id: true,
      currentUsername: true,
      loginName: true,
      isMainAdmin: true,
    },
  })

  if (!reader?.loginName) {
    return null
  }

  return reader
}

/**
 * Checks whether the request belongs to an authenticated admin session.
 *
 * @param request Incoming request.
 * @returns `true` when the admin cookie is present and valid.
 */
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  return Boolean(await getAdminSessionReader(request))
}

/**
 * Narrows a reader row to a reader that can log into admin.
 *
 * @param reader Reader row fetched from the database.
 * @returns `true` when the reader has a configured admin login.
 */
export function hasAdminLogin(reader: Pick<Reader, 'loginName' | 'passwordHash'>): boolean {
  return Boolean(reader.loginName && reader.passwordHash)
}
