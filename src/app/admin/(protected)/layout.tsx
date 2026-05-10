import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
import {
  ADMIN_COOKIE_NAME,
  getAdminSessionReaderFromValue,
} from '@/lib/admin-auth'

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? null
  const adminReader = await getAdminSessionReaderFromValue(adminCookie)

  if (!adminReader) {
    redirect('/admin/login')
  }

  return <AdminShell>{children}</AdminShell>
}
