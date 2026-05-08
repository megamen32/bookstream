import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings, updateAppSettings } from '@/lib/app-settings'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

/**
 * GET /api/admin/settings
 * Returns the current admin session role and global publishing flag.
 */
export async function GET(request: NextRequest) {
  const adminReader = await getAdminSessionReader(request)
  if (!adminReader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getAppSettings()
  return NextResponse.json({
    settings,
    reader: adminReader,
  })
}

/**
 * PUT /api/admin/settings
 * Allows the main admin to update global publishing rules.
 */
export async function PUT(request: NextRequest) {
  const adminReader = await getAdminSessionReader(request)
  if (!adminReader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!adminReader.isMainAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as { allowUserPublishing?: boolean }
  if (typeof body.allowUserPublishing !== 'boolean') {
    return NextResponse.json({ error: 'allowUserPublishing is required' }, { status: 400 })
  }

  const settings = await updateAppSettings({
    allowUserPublishing: body.allowUserPublishing,
  })

  if (!settings.allowUserPublishing) {
    await db.book.updateMany({
      where: {
        isPublic: true,
        author: {
          owner: {
            isMainAdmin: false,
          },
        },
      },
      data: {
        isPublic: false,
      },
    })
  }

  return NextResponse.json({
    settings,
    reader: adminReader,
  })
}
