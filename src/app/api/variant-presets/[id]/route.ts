import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

/**
 * PUT /api/variant-presets/[id]
 * Update a variant preset.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const preset = await db.variantPreset.update({
      where: { id },
      data: body,
    })

    return NextResponse.json({ preset })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Пресет не найден' }, { status: 404 })
    }
    console.error('Error updating variant preset:', error)
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}

/**
 * DELETE /api/variant-presets/[id]
 * Delete a variant preset.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    await db.variantPreset.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Пресет не найден' }, { status: 404 })
    }
    console.error('Error deleting variant preset:', error)
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
