import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { resolveGoogleDriveImportTarget } from '@/lib/google-drive-import'

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    if (!await getAdminSessionReader(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      url?: string
      fileId?: string
      accessToken?: string
      mimeType?: string
      name?: string
    }
    const sourceUrl = body.url?.trim() || ''
    const target = resolveGoogleDriveImportTarget(sourceUrl)
    const fileId = body.fileId?.trim() || ''
    const accessToken = body.accessToken?.trim() || ''
    const pickerFile = /^[a-zA-Z0-9_-]{10,}$/.test(fileId) && Boolean(accessToken)
    if (!target && !pickerFile) {
      return NextResponse.json({ error: 'Укажите ссылку на Google Docs или Google Drive файл' }, { status: 400 })
    }

    const isGoogleDoc = body.mimeType === 'application/vnd.google-apps.document'
    const pickerUrl = isGoogleDoc
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`
      : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
    const response = await fetch(pickerFile ? pickerUrl : target?.exportUrl || '', {
      redirect: 'follow',
      headers: pickerFile ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    if (!response.ok) {
      return NextResponse.json({ error: 'Не удалось скачать документ. Проверьте доступ к файлу.' }, { status: 422 })
    }

    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > MAX_DOWNLOAD_BYTES) {
      return NextResponse.json({ error: 'Файл слишком большой для импорта (максимум 25 МБ).' }, { status: 413 })
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_DOWNLOAD_BYTES) {
      return NextResponse.json({ error: 'Файл слишком большой для импорта (максимум 25 МБ).' }, { status: 413 })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${pickerFile ? body.name?.trim() || 'google-drive-book.docx' : target?.fileName || 'google-drive-book.docx'}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error importing Google Drive file:', error)
    return NextResponse.json({ error: 'Не удалось импортировать файл из Google Drive' }, { status: 500 })
  }
}
