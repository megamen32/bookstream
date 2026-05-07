import { NextRequest } from 'next/server'

/**
 * Checks whether the current request belongs to an authenticated admin session.
 *
 * @param request Incoming Next.js request.
 * @returns True when the admin auth cookie is present and valid.
 */
export function isAdminRequest(request: NextRequest): boolean {
  return request.cookies.get('bookstream_admin')?.value === 'authenticated'
}
