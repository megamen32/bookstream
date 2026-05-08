'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, DownloadCloud, Settings2, Shapes } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserAreaLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

const NAV_ITEMS = [
  {
    href: '/me/annotations',
    label: 'Мои аннотации',
    icon: Shapes,
  },
  {
    href: '/me/settings',
    label: 'Настройки',
    icon: Settings2,
  },
  {
    href: '/me/offline',
    label: 'Офлайн',
    icon: DownloadCloud,
  },
]

export default function UserAreaLayout({
  title,
  description,
  children,
}: UserAreaLayoutProps): React.ReactElement {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            К книгам
          </Link>
        </div>

        <div className="mb-8 space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
                    active
                      ? 'bg-card text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                  style={active ? {
                    borderColor: 'var(--user-accent-border)',
                    backgroundColor: 'var(--user-accent-soft)',
                    color: 'var(--user-accent-text)',
                  } : undefined}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
