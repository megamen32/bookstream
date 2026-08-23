import { NextResponse } from 'next/server'
import { buildBookExport, isBookExportFormat } from '@/lib/book-export'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

interface RouteParams {
  bookId: string
  format: string
}

export async function GET(_request: Request, { params }: { params: Promise<RouteParams> }) {
  const { bookId, format } = await params
  if (!isBookExportFormat(format)) return NextResponse.json({ error: 'Unsupported export format' }, { status: 400 })

  const book = await db.book.findFirst({
    where: { id: bookId, isPublic: true },
    include: {
      author: { select: { name: true } },
      chapters: { orderBy: { position: 'asc' }, include: { variants: { orderBy: { createdAt: 'asc' } } } },
    },
  })
  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  const exportFile = await buildBookExport({
    title: book.title,
    authorName: book.author.name,
    description: book.description,
    chapters: book.chapters.flatMap((chapter) => {
      const variant = chapter.variants.find((item) => item.variantType === 'original') || chapter.variants[0]
      return variant ? [{ title: chapter.title, contentHtml: variant.contentHtml }] : []
    }),
  }, format)

  return new NextResponse(new Uint8Array(exportFile.buffer), {
    headers: {
      'Content-Type': exportFile.contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(exportFile.fileName)}`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
