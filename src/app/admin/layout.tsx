'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen, Library, Upload, User, LogOut, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin', label: 'Библиотека', icon: Library },
  { href: '/admin/upload', label: 'Загрузить', icon: Upload },
  { href: '/admin/profile', label: 'Профиль', icon: User },
]

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-foreground">Bookstream</h1>
          <p className="text-xs text-muted-foreground">Панель управления</p>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-3">
        <form action="/api/auth/logout" method="POST">
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
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
    <div className="min-h-screen flex bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col fixed h-full z-30">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-40 flex items-center px-4">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Меню навигации</SheetTitle>
            <SidebarContent
              pathname={pathname}
              onNavigate={() => setSheetOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <div className="ml-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-600" />
          <span className="font-semibold text-foreground">Bookstream</span>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-64">
        <div className="pt-14 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  )
}
