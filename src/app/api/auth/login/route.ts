import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionValue,
  getAdminSessionCookieOptions,
} from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { canAuthenticateAdmin } from '@/lib/admin-login'
import { ensureReaderAuthorProfile } from '@/lib/admin-ownership'

export async function POST(request: NextRequest) {
  const body = await request.json() as { username?: string; password?: string; readerId?: string; currentUsername?: string }
  const username = body.username?.trim()
  const password = body.password?.trim()
  const readerId = body.readerId?.trim()
  const currentUsername = body.currentUsername?.trim()

  if (!username && !readerId) {
    return NextResponse.json({ error: 'Имя или профиль читателя обязательны' }, { status: 400 })
  }

  let reader = readerId
    ? await db.reader.findUnique({
        where: { id: readerId },
        select: {
          id: true,
          currentUsername: true,
          loginName: true,
          passwordHash: true,
          isMainAdmin: true,
        },
      })
    : await db.reader.findUnique({
        where: { loginName: username! },
        select: {
          id: true,
          currentUsername: true,
          loginName: true,
          passwordHash: true,
          isMainAdmin: true,
        },
      })

  if (readerId && currentUsername && (!reader || !reader.loginName)) {
    const conflictingReader = await db.reader.findFirst({
      where: {
        loginName: currentUsername,
        NOT: { id: readerId },
      },
      select: { id: true },
    })

    reader = await db.reader.upsert({
      where: { id: readerId },
      create: {
        id: readerId,
        currentUsername,
        loginName: conflictingReader ? null : currentUsername,
      },
      update: {
        currentUsername,
        ...(!conflictingReader ? { loginName: currentUsername } : {}),
      },
      select: {
        id: true,
        currentUsername: true,
        loginName: true,
        passwordHash: true,
        isMainAdmin: true,
      },
    })
  }

  if (!reader) {
    return NextResponse.json({ error: 'Профиль читателя не найден' }, { status: 401 })
  }

  const sameLocalReader = Boolean(readerId && currentUsername && reader.currentUsername === currentUsername)

  if (sameLocalReader) {
    await ensureReaderAuthorProfile(reader.id, reader.currentUsername)
  }

  if (reader.passwordHash && !password) {
    return NextResponse.json({ error: 'Пароль обязателен для этого профиля' }, { status: 400 })
  }

  if (reader.passwordHash && !canAuthenticateAdmin(reader.passwordHash, password || '')) {
    return NextResponse.json({ error: 'Неверное имя или пароль' }, { status: 401 })
  }

  const response = NextResponse.json({
    success: true,
    reader: {
      id: reader.id,
      currentUsername: reader.currentUsername,
      loginName: reader.loginName,
      isMainAdmin: reader.isMainAdmin,
    },
  })
  response.cookies.set(
    ADMIN_COOKIE_NAME,
    createAdminSessionValue(reader.id),
    getAdminSessionCookieOptions()
  )
  return response
}
