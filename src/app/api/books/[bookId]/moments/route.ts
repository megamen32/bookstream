import { NextRequest, NextResponse } from 'next/server'
import { BookMomentValidationError, createBookMoment } from '@/lib/public-books'
import { buildMomentReaderHref, buildPublicMomentUrl } from '@/lib/public-sharing'

interface RouteParams {
  bookId: string
}

interface CreateMomentBody {
  authorSlug?: string
  bookSlug?: string
  chapterId?: string
  variantType?: string
  readingMode?: string
  paragraphStart?: string
  paragraphEnd?: string | null
  startOffset?: number
  endOffset?: number
  quoteText?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { bookId } = await params
    const body = await request.json() as CreateMomentBody

    const moment = await createBookMoment({
      bookId,
      authorSlug: typeof body.authorSlug === 'string' ? body.authorSlug : '',
      bookSlug: typeof body.bookSlug === 'string' ? body.bookSlug : '',
      chapterId: typeof body.chapterId === 'string' ? body.chapterId : '',
      variantType: typeof body.variantType === 'string' && body.variantType.length > 0
        ? body.variantType
        : 'original',
      readingMode: typeof body.readingMode === 'string' && body.readingMode.length > 0
        ? body.readingMode
        : 'feed',
      paragraphStart: typeof body.paragraphStart === 'string' ? body.paragraphStart : '',
      paragraphEnd: typeof body.paragraphEnd === 'string' ? body.paragraphEnd : null,
      startOffset: Number.isFinite(body.startOffset) ? Number(body.startOffset) : Number.NaN,
      endOffset: Number.isFinite(body.endOffset) ? Number(body.endOffset) : Number.NaN,
      quoteText: typeof body.quoteText === 'string' ? body.quoteText : '',
    })

    return NextResponse.json({
      moment,
      publicUrl: buildPublicMomentUrl(moment.authorSlug, moment.bookSlug, moment.id),
      readerUrl: buildMomentReaderHref(moment),
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating book moment:', error)

    if (error instanceof BookMomentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Не удалось создать момент' }, { status: 500 })
  }
}
