import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import mammoth from 'mammoth'
import { marked } from 'marked'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    let htmlContent = ''

    if (fileName.endsWith('.txt')) {
      const text = await file.text()
      htmlContent = text
        .split('\n\n')
        .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('')
    } else if (fileName.endsWith('.md')) {
      const text = await file.text()
      htmlContent = await marked(text)
    } else if (fileName.endsWith('.docx')) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await mammoth.convertToHtml({ buffer })
      htmlContent = result.value
    } else {
      return NextResponse.json({ error: 'Неподдерживаемый формат файла' }, { status: 400 })
    }

    // Split content into chapters by headings or double newlines
    const chapterParts = splitIntoChapters(htmlContent)

    // Create chapters with original variants
    for (let i = 0; i < chapterParts.length; i++) {
      const chapterTitle = chapterParts[i].title || `Глава ${i + 1}`
      const chapter = await db.chapter.create({
        data: {
          bookId,
          title: chapterTitle,
          position: i,
        },
      })

      await db.chapterVariant.create({
        data: {
          chapterId: chapter.id,
          variantType: 'original',
          contentHtml: chapterParts[i].content,
        },
      })
    }

    return NextResponse.json({
      success: true,
      chaptersCreated: chapterParts.length,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Ошибка загрузки файла' }, { status: 500 })
  }
}

function splitIntoChapters(html: string): { title: string; content: string }[] {
  // Try to split by h1, h2, h3 headings
  const headingRegex = /<(h[1-3])[^>]*>(.*?)<\/\1>/gi
  const matches: { index: number; title: string }[] = []

  let match
  while ((match = headingRegex.exec(html)) !== null) {
    // Clean HTML tags from title
    const cleanTitle = match[2].replace(/<[^>]*>/g, '').trim()
    if (cleanTitle) {
      matches.push({ index: match.index, title: cleanTitle })
    }
  }

  if (matches.length > 0) {
    const chapters: { title: string; content: string }[] = []
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index
      const end = i + 1 < matches.length ? matches[i + 1].index : html.length
      chapters.push({
        title: matches[i].title,
        content: html.slice(start, end).trim(),
      })
    }
    return chapters
  }

  // No headings found — split by paragraphs into groups of ~10
  const paragraphs = html.split(/<\/p>/i).filter((p) => p.trim())
  const chapters: { title: string; content: string }[] = []
  const chunkSize = 10

  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    const chunk = paragraphs.slice(i, i + chunkSize)
    chapters.push({
      title: `Глава ${chapters.length + 1}`,
      content: chunk.join('</p>').trim() + '</p>',
    })
  }

  return chapters.length > 0 ? chapters : [{ title: 'Глава 1', content: html }]
}
