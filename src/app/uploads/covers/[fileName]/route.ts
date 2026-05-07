import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { isSafeCoverFileName, resolveCoverDirectories } from '@/lib/cover-storage'

/**
 * Serves uploaded book covers from the configured storage directories.
 *
 * @param _request Incoming request.
 * @param context Route params.
 * @returns Cover image response or 404 when the file is unavailable.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ fileName: string }> }
): Promise<NextResponse> {
  const { fileName } = await context.params

  if (!isSafeCoverFileName(fileName)) {
    return NextResponse.json({ error: 'Обложка не найдена' }, { status: 404 })
  }

  for (const coverDirectory of resolveCoverDirectories()) {
    const coverPath = path.join(coverDirectory, fileName)

    try {
      const file = await readFile(coverPath)

      return new NextResponse(file, {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Type': 'image/webp',
        },
      })
    } catch (error: unknown) {
      if (!isFileNotFoundError(error)) {
        console.error('Error reading cover file:', error)
      }
    }
  }

  return NextResponse.json({ error: 'Обложка не найдена' }, { status: 404 })
}

/**
 * Checks whether a filesystem error means the file is absent.
 *
 * @param error Unknown read error.
 * @returns `true` for missing file errors.
 */
function isFileNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'ENOENT'
  )
}
