import 'dotenv/config'
import mammoth from 'mammoth'
import { db } from '../src/lib/db.ts'
import { saveChapterVariantRevision } from '../src/lib/chapter-revisions.ts'
import {
  persistImportedBookCover,
  persistImportedBookImage,
  readImportedBookFile,
} from '../src/lib/book-import.ts'
import {
  flattenImportedSections,
  splitImportedHtmlIntoSections,
} from '../src/lib/imported-book-html.ts'
import { transformBibliographicAnnotations } from '../src/lib/books/annotations/transformBibliographicAnnotations.ts'

const authorSlug = 'nikita-rozanov'

const books = [
  {
    slug: 'dialektika-matematiki',
    title: 'Диалектика Математики',
    description: 'Философское исследование математики, абстракции, смысла и способов познания мира.',
    sourcePath: '/tmp/1kRnkgG2ET-3ZJYd9O8g2KAwk7spPkn9caMsU4BQN7ig.docx',
    coverPath: 'public/uploads/import-covers/dialektika-matematiki.png',
  },
  {
    slug: 'teorema-boga',
    title: 'Теорема Бога',
    description: 'Философское сочинение о природе Бога, мире и границах доказательства.',
    sourcePath: '/tmp/12qGKDEcSb6KAOVU2G7dEp6NJhwdl2Y2iAWHcPlsaToU.docx',
    coverPath: 'public/uploads/import-covers/teorema-boga.png',
  },
  {
    slug: 'ideya',
    title: 'Идея',
    description: 'Философское сочинение о Creative Community, общественных ценностях и развитии идей.',
    sourcePath: '/tmp/bookstream-ideya.md',
    coverPath: 'public/uploads/import-covers/ideya.png',
  },
] as const

async function importBook(bookInput: typeof books[number], authorId: string): Promise<void> {
  const existing = await db.book.findUnique({
    where: { authorId_slug: { authorId, slug: bookInput.slug } },
    select: { id: true, _count: { select: { chapters: true } } },
  })

  if (existing) {
    if (existing._count.chapters > 0) {
      throw new Error(`Книга уже существует и содержит главы: ${bookInput.slug}`)
    }
    await db.book.delete({ where: { id: existing.id } })
  }

  const book = await db.book.create({
    data: {
      authorId,
      slug: bookInput.slug,
      title: bookInput.title,
      description: bookInput.description,
      readingModeDefault: 'feed',
    },
  })

  const source = Bun.file(bookInput.sourcePath)
  const imported = await readImportedBookFile(
    new File([await source.arrayBuffer()], source.name, { type: source.type }),
    bookInput.sourcePath.endsWith('.docx')
      ? {
          convertImage: mammoth.images.imgElement(async (image) => ({
            src: await persistImportedBookImage({ bookId: book.id, image }),
          })),
        }
      : undefined,
  )
  const sections = flattenImportedSections(
    splitImportedHtmlIntoSections(imported.html, bookInput.title),
  )

  let position = 0
  for (const section of sections) {
    const transformed = transformBibliographicAnnotations(section.contentHtml)
    const chapter = await db.chapter.create({
      data: {
        bookId: book.id,
        title: section.title || `Глава ${position + 1}`,
        position,
        level: section.level,
      },
    })
    await db.$transaction((tx) => saveChapterVariantRevision(tx, {
      chapterId: chapter.id,
      variantType: 'original',
      contentHtml: transformed.html,
      editedByAuthor: true,
      source: 'import',
    }))
    position += 1
  }

  const coverFile = new File(
    [await Bun.file(bookInput.coverPath).arrayBuffer()],
    `${bookInput.slug}.png`,
    { type: 'image/png' },
  )
  const coverUrl = await persistImportedBookCover({
    bookId: book.id,
    bookSlug: book.slug,
    coverFile,
    suggestedCoverDataUrl: null,
  })
  if (!coverUrl) {
    throw new Error(`Обложка не сохранена: ${bookInput.slug}`)
  }

  await db.book.update({
    where: { id: book.id },
    data: { coverUrl, isPublic: true },
  })

  const imageCount = (imported.html.match(/<img\b/gi) || []).length
  const readableSections = sections.filter((section) => section.isReadable).length
  console.log(JSON.stringify({
    slug: book.slug,
    bookId: book.id,
    chapters: sections.length,
    readableSections,
    images: imageCount,
    coverUrl,
    public: true,
  }))
}

const author = await db.author.findUnique({ where: { slug: authorSlug }, select: { id: true } })
if (!author) {
  throw new Error(`Автор не найден: ${authorSlug}`)
}

try {
  for (const book of books) {
    await importBook(book, author.id)
  }
} finally {
  await db.$disconnect()
}
