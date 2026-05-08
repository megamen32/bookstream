'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

function normalizeLinkCode(value: string): string {
  return value.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
}

/**
 * Public page that consumes a one-time code and creates an admin session on the current device.
 *
 * @returns Device-link form for new browsers or phones.
 */
export default function AdminLinkDevicePage(): React.ReactElement {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [code, setCode] = useState(() => normalizeLinkCode(searchParams.get('code') || ''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    const normalizedCode = normalizeLinkCode(code)
    if (normalizedCode.length !== 16) {
      setError('Код должен содержать 16 шестнадцатеричных символов.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/link-codes/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      })

      const payload = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось применить код')
      }

      toast({
        title: 'Устройство подключено',
        description: 'Сессия создана на этом устройстве. Старое устройство останется в системе.',
      })
      router.push('/admin')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось применить код')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(217,119,6,0.16),_transparent_32%),linear-gradient(180deg,_#faf7f2_0%,_#fff7ed_35%,_#ffffff_100%)] p-4">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center">
        <Card className="w-full border-amber-200/60 shadow-xl shadow-amber-950/5">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
              <Smartphone className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-semibold text-foreground">Подключить устройство</CardTitle>
              <CardDescription className="leading-6 text-muted-foreground">
                Введите одноразовый code или отсканируйте QR. Старое устройство не будет разлогинено.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="link-code">Transfer code</Label>
                <Input
                  id="link-code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value)
                    setError('')
                  }}
                  placeholder="ABCD-EF12-3456-7890"
                  autoComplete="one-time-code"
                  autoFocus
                  className="h-11 font-mono tracking-[0.2em]"
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Если code уже встроен в ссылку из QR, он появится автоматически.
                </p>
              </div>

              {error ? (
                <p className="text-sm font-medium text-destructive">{error}</p>
              ) : null}

              <Button type="submit" className="h-11 w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Подключение...
                  </>
                ) : (
                  <>
                    Подключить
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
