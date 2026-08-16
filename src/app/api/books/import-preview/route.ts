import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { buildImportedBookPreview } from '@/lib/book-import'
import { createChatCompletion, resolveReaderLlmConfig } from '@/lib/llm'
import { db } from '@/lib/db'

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

    const reader = await db.reader.findUnique({
      where: { id: adminReader.id },
      select: { isMainAdmin: true, llmApiKey: true, llmBaseUrl: true, llmModel: true },
    })
    const llm = reader ? resolveReaderLlmConfig(reader) : null
    const preview = await buildImportedBookPreview(file, {
      suggestMetadata: llm
        ? async ({ excerpt, imageCandidates }) => {
            const response = await createChatCompletion({
              messages: [
                {
                  role: 'system',
                  content: 'Ты редактор книжного каталога. Верни только JSON без markdown: {"title": string|null, "description": string|null, "coverIndex": number|null}. Извлеки название и краткое описание по первым двум содержательным разделам. coverIndex выбирай только среди портретных или явно обложечных изображений; иначе null.',
                },
                {
                  role: 'user',
                  content: 'Первые два раздела документа:\\n' + excerpt + '\\n\\nКандидаты изображений:\\n' + JSON.stringify(imageCandidates),
                },
              ],
              temperature: 0,
              maxTokens: 600,
            }, llm.config)
            return response
          }
        : undefined,
    })
    return NextResponse.json(preview)
  } catch (error) {
    console.error('Error building import preview:', error)
    return NextResponse.json({ error: 'Не удалось разобрать файл' }, { status: 500 })
  }
}
