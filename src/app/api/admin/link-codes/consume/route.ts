import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, createAdminSessionValue, getAdminSessionCookieOptions } from '@/lib/admin-auth'
import {
  hashAdminLinkCode,
  isActiveAdminLinkCode,
  normalizeAdminLinkCode,
} from '@/lib/admin-link-codes'
import { db } from '@/lib/db'

interface ConsumeLinkCodeBody {
  code?: string
}

/**
 * POST /api/admin/link-codes/consume
 * Creates a new admin session on the current device using a short-lived one-time code.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConsumeLinkCodeBody
    const normalizedCode = normalizeAdminLinkCode(body.code || '')
    if (normalizedCode.length !== 16) {
      return NextResponse.json({ error: 'Код должен содержать 16 шестнадцатеричных символов' }, { status: 400 })
    }

    const codeHash = hashAdminLinkCode(normalizedCode)
    const now = new Date()
    const linkCode = await db.adminLinkCode.findUnique({
      where: { codeHash },
      select: {
        id: true,
        readerId: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
        reader: {
          select: {
            id: true,
            currentUsername: true,
            loginName: true,
            isMainAdmin: true,
          },
        },
      },
    })

    if (!linkCode || !isActiveAdminLinkCode(linkCode, now)) {
      return NextResponse.json({ error: 'Код недействителен или истек' }, { status: 400 })
    }

    if (!linkCode.reader.loginName) {
      return NextResponse.json({ error: 'У владельца нет логина для админки' }, { status: 409 })
    }

    const consumeResult = await db.adminLinkCode.updateMany({
      where: {
        id: linkCode.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
      },
    })

    if (consumeResult.count === 0) {
      return NextResponse.json({ error: 'Код уже использован или истек' }, { status: 409 })
    }

    const response = NextResponse.json({
      success: true,
      reader: {
        id: linkCode.reader.id,
        currentUsername: linkCode.reader.currentUsername,
        loginName: linkCode.reader.loginName,
        isMainAdmin: linkCode.reader.isMainAdmin,
      },
      expiresAt: linkCode.expiresAt.toISOString(),
    })
    response.cookies.set(
      ADMIN_COOKIE_NAME,
      createAdminSessionValue(linkCode.readerId),
      getAdminSessionCookieOptions()
    )
    return response
  } catch (error) {
    console.error('Error consuming admin link code:', error)
    return NextResponse.json({ error: 'Не удалось применить код' }, { status: 500 })
  }
}
