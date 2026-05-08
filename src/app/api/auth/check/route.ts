import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const reader = await getAdminSessionReader(request)

  if (reader) {
    return NextResponse.json({
      authenticated: true,
      reader,
    })
  }

  return NextResponse.json({ authenticated: false }, { status: 401 })
}
