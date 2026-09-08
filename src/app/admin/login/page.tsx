'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const READER_STORAGE_KEY = 'bookstream-reader-state'

type StoredReader = { readerId?: string; username?: string }

function readLocalReader(): StoredReader | null {
  try {
    const raw = localStorage.getItem(READER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredReader
    return parsed.readerId && parsed.username ? parsed : null
  } catch {
    return null
  }
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoChecking, setAutoChecking] = useState(true)
  const [manualLogin, setManualLogin] = useState(false)
  const [error, setError] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    const forceManual = params.get('manual') === '1' || params.get('switch') === '1'
    if (forceManual) {
      const frame = window.requestAnimationFrame(() => {
        if (!cancelled) {
          setManualLogin(true)
          setAutoChecking(false)
        }
      })
      return () => {
        cancelled = true
        window.cancelAnimationFrame(frame)
      }
    }

    async function continueCurrentReader(): Promise<void> {
      try {
        const current = readLocalReader()
        if (!current?.readerId || !current.username) return

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readerId: current.readerId,
            currentUsername: current.username,
          }),
        })

        if (res.ok && !cancelled) {
          router.replace('/admin')
          router.refresh()
          return
        }
      } catch {
        // Fall back to the manual form below.
      } finally {
        if (!cancelled) setAutoChecking(false)
      }
    }

    void continueCurrentReader()
    return () => { cancelled = true }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        const data = await res.json() as { reader?: { id?: string; currentUsername?: string } }
        if (data.reader?.id && data.reader.currentUsername) {
          localStorage.setItem(READER_STORAGE_KEY, JSON.stringify({
            readerId: data.reader.id,
            username: data.reader.currentUsername,
          }))
        }
        toast({ title: 'Вход выполнен', description: 'Добро пожаловать!' })
        router.replace('/admin')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Ошибка входа')
      }
    } catch {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }

  if (autoChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Открываем ваш профиль…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-amber-200/50">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Bookstream</CardTitle>
          <CardDescription className="text-muted-foreground">
            {manualLogin
              ? 'Выберите нужный профиль: введите его логин и пароль.'
              : 'Обычно вход происходит автоматически из текущего профиля читателя. Эта форма нужна для нового устройства.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Имя читателя</Label>
              <Input id="username" placeholder="Имя читателя" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль, если задан</Label>
              <Input id="password" type="password" placeholder="Можно оставить пустым" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
            </div>
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
            <Button type="submit" className="w-full h-11 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-medium shadow-md" disabled={loading || !username.trim()}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {manualLogin ? 'Войти в профиль' : 'Войти на новом устройстве'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
