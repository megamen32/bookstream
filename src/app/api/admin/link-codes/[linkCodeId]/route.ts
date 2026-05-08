import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{
    linkCodeId: string
  }>
}

/**
 * DELETE /api/admin/link-codes/:linkCodeId
 * Revokes an unused one-time link code owned by the current admin.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const adminReader = await getAdminSessionReader(request)
  if (!adminReader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { linkCodeId } = await params
  const revokedAt = new Date()
  const result = await db.adminLinkCode.updateMany({
    where: {
      id: linkCodeId,
      readerId: adminReader.id,
      usedAt: null,
      revokedAt: null,
    },
    data: {
      revokedAt,
    },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: 'Link code not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    revokedAt: revokedAt.toISOString(),
  })
}
