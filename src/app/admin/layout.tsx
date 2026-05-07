'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { BookOpen, Library, Upload, User, LogOut, Menu, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin', label: 'Библиотека', icon: Library },
  { href: '/admin/upload', label: 'Загрузить', icon: Upload },
  { href: '/admin/variants', label: 'Варианты', icon: Palette },
  { href: '/admin/profile', label: 'Профиль', icon: User },
]

type SidebarNavProps = {
  pathname: string
  onNavigate?: () => void
}

function AdminSidebarNav({ pathname, onNavigate }: SidebarNavProps) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <div className="flex h-full flex-col">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 text-white shadow-md">
          <BookOpen className="h-5 w-5 shrink-0" />
          <div className="group-data-[collapsible=icon]:hidden">
            <h1 className="font-semibold leading-none">Bookstream</h1>
            <p className="mt-1 text-xs/none text-white/80">Панель управления</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="py-3">
        <SidebarMenu className="px-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className={cn(
                    'h-11 rounded-2xl px-3',
                    isActive
                      ? 'bg-amber-100 text-amber-900 hover:bg-amber-100 hover:text-amber-900 dark:bg-amber-900/20 dark:text-amber-300'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Link
                    href={item.href}
                    onClick={() => {
                      onNavigate?.()
                      if (isMobile) {
                        setOpenMobile(false)
                      }
                    }}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        <form action="/api/auth/logout" method="POST">
          <Button
            type="submit"
            variant="ghost"
            className="h-11 w-full justify-start gap-3 rounded-2xl text-muted-foreground hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Выйти</span>
          </Button>
        </form>
      </SidebarFooter>

      <SidebarRail />
    </div>
  )
}

function MobileSidebarTrigger() {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="-ml-2"
      onClick={toggleSidebar}
      aria-label="Открыть меню"
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/auth/check')
      .then((res) => {
        if (res.ok) {
          setAuthenticated(true)
        } else {
          setAuthenticated(false)
          router.push('/admin/login')
        }
      })
      .catch(() => {
        setAuthenticated(false)
        router.push('/admin/login')
      })
  }, [router])

  // Don't redirect away from login page
  const isLoginPage = pathname === '/admin/login'

  if (!isLoginPage && (authenticated === null || !authenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-gray-50">
        <Sidebar side="left" collapsible="icon" className="border-r border-gray-200 bg-white">
          <AdminSidebarNav pathname={pathname} />
        </Sidebar>

        <SidebarInset className="bg-gray-50">
          <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b border-gray-200 bg-white px-4">
            <MobileSidebarTrigger />
            <div className="ml-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-foreground">Bookstream</span>
            </div>
          </div>

          <div className="pt-14 lg:pt-0">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
