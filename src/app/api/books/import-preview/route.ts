import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { buildImportedBookPreview } from '@/lib/book-import'

export async function POST(request: NextRequest) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    }

    const preview = await buildImportedBookPreview(file)
    return NextResponse.json(preview)
  } catch (error) {
    console.error('Error building import preview:', error)
    return NextResponse.json({ error: 'Не удалось разобрать файл' }, { status: 500 })
  }
}
