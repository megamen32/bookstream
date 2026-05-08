import { NextRequest, NextResponse } from 'next/server'
import { ensureReaderAuthorProfile } from '@/lib/admin-ownership'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password-auth'

interface SetReaderPasswordBody {
  readerId?: string
  currentUsername?: string
  password?: string
}

/**
 * POST /api/readers/password
 * Assigns or updates the reader's admin password. Login is always the current reader name.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SetReaderPasswordBody
    const readerId = body.readerId?.trim()
    const currentUsername = body.currentUsername?.trim()
    const password = body.password?.trim()

    if (!readerId || !currentUsername || !password) {
      return NextResponse.json(
        { error: 'readerId, currentUsername and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: 'Пароль должен быть не короче 4 символов' },
        { status: 400 }
      )
    }

    const conflictingReader = await db.reader.findFirst({
      where: {
        loginName: currentUsername,
        NOT: { id: readerId },
      },
      select: { id: true },
    })

    if (conflictingReader) {
      return NextResponse.json(
        { error: 'Это имя уже занято другим пользователем для входа в админку' },
        { status: 409 }
      )
    }

    const reader = await db.reader.upsert({
      where: { id: readerId },
      update: {
        currentUsername,
        loginName: currentUsername,
        passwordHash: hashPassword(password),
      },
      create: {
        id: readerId,
        currentUsername,
        loginName: currentUsername,
        passwordHash: hashPassword(password),
      },
      select: {
        id: true,
        currentUsername: true,
        loginName: true,
      },
    })

    const author = await ensureReaderAuthorProfile(reader.id, reader.currentUsername)

    return NextResponse.json({
      success: true,
      reader,
      author,
    })
  } catch (error) {
    console.error('Error setting reader password:', error)
    return NextResponse.json({ error: 'Не удалось сохранить пароль' }, { status: 500 })
  }
}
