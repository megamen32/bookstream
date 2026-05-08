import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

/**
 * GET /api/variant-presets
 * List all variant presets, ordered by position.
 */
export async function GET() {
  try {
    const presets = await db.variantPreset.findMany({
      orderBy: { position: 'asc' },
    })
    return NextResponse.json({ presets })
  } catch (error) {
    console.error('Error fetching variant presets:', error)
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}

/**
 * POST /api/variant-presets
 * Create a new variant preset.
 *
 * Body:
 *   slug, label, emoji?, description?, targetPercent, systemPromptTemplate, position?
 */
export async function POST(request: NextRequest) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { slug, label, emoji, description, targetSizePercent, systemPromptTemplate, position } = body

    if (!slug || !label || !systemPromptTemplate) {
      return NextResponse.json(
        { error: 'Обязательные поля: slug, label, systemPromptTemplate' },
        { status: 400 }
      )
    }

    const preset = await db.variantPreset.create({
      data: {
        slug,
        label,
        emoji: emoji || '',
        description: description || '',
        targetSizePercent: targetSizePercent ?? null,
        systemPromptTemplate,
        position: position || 0,
      },
    })

    return NextResponse.json({ preset }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Пресет с таким slug уже существует' }, { status: 409 })
    }
    console.error('Error creating variant preset:', error)
    return NextResponse.json({ error: 'Ошибка создания' }, { status: 500 })
  }
}
