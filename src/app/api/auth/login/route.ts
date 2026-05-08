import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionValue,
  getAdminSessionCookieOptions,
} from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password-auth'

export async function POST(request: NextRequest) {
  const body = await request.json() as { username?: string; password?: string }
  const username = body.username?.trim()
  const password = body.password?.trim()

  if (!username || !password) {
    return NextResponse.json({ error: 'Имя и пароль обязательны' }, { status: 400 })
  }

  const reader = await db.reader.findUnique({
    where: { loginName: username },
    select: {
      id: true,
      currentUsername: true,
      loginName: true,
      passwordHash: true,
      isMainAdmin: true,
    },
  })

  if (!reader?.passwordHash || !verifyPassword(password, reader.passwordHash)) {
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
