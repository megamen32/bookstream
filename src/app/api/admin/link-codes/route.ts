import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import {
  createAdminLinkCode,
  createAdminLinkCodeExpiry,
  formatAdminLinkCode,
  hashAdminLinkCode,
  normalizeAdminLinkCode,
} from '@/lib/admin-link-codes'
import { db } from '@/lib/db'

interface AdminLinkCodeResponse {
  id: string
  code: string
  expiresAt: string
  createdAt: string
}

/**
 * POST /api/admin/link-codes
 * Issues a new one-time code for linking another device to the same admin account.
 */
export async function POST(request: NextRequest) {
  const adminReader = await getAdminSessionReader(request)
  if (!adminReader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const code = createAdminLinkCode()
  const normalizedCode = normalizeAdminLinkCode(code)
  const linkCode = await db.adminLinkCode.create({
    data: {
      readerId: adminReader.id,
      codeHash: hashAdminLinkCode(normalizedCode),
      expiresAt: createAdminLinkCodeExpiry(now),
    },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
    },
  })

  const payload: AdminLinkCodeResponse = {
    id: linkCode.id,
    code: formatAdminLinkCode(normalizedCode),
    createdAt: linkCode.createdAt.toISOString(),
    expiresAt: linkCode.expiresAt.toISOString(),
  }

  return NextResponse.json(payload, { status: 201 })
}
