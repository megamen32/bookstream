'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Copy, Loader2, QrCode, RefreshCcw, Smartphone, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

interface AdminLinkCodePayload {
  id: string
  code: string
  createdAt: string
  expiresAt: string
}

interface GeneratedAdminLinkCode {
  id: string
  code: string
  createdAt: Date
  expiresAt: Date
}

function buildLinkDeviceUrl(code: string): string {
  if (typeof window === 'undefined') {
    return `/admin/link-device?code=${encodeURIComponent(code)}`
  }

  return new URL(`/admin/link-device?code=${encodeURIComponent(code)}`, window.location.origin).toString()
}

/**
 * Shows the one-time device linking flow for the authenticated admin.
 *
 * @returns Card with code generation, QR rendering, and revoke controls.
 */
export default function AdminLinkDeviceCard(): React.ReactElement {
  const { toast } = useToast()
  const [generatedCode, setGeneratedCode] = useState<GeneratedAdminLinkCode | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    if (!generatedCode) {
      return
    }

    let active = true
    const linkUrl = buildLinkDeviceUrl(generatedCode.code)

    void QRCode.toDataURL(linkUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    })
      .then((value) => {
        if (active) {
          setQrDataUrl(value)
        }
      })
      .catch((error) => {
        console.error('Error generating admin link QR:', error)
        if (active) {
          setQrDataUrl('')
        }
      })

    return () => {
      active = false
    }
  }, [generatedCode])

  const copyText = async (text: string, title: string, description?: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title, description })
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось скопировать текст.',
        variant: 'destructive',
      })
    }
  }

  const handleCreate = async (): Promise<void> => {
    setCreating(true)
    try {
      const response = await fetch('/api/admin/link-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const payload = await response.json() as { error?: string } & AdminLinkCodePayload
      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось создать код')
      }

      setQrDataUrl('')
      setGeneratedCode({
        id: payload.id,
        code: payload.code,
        createdAt: new Date(payload.createdAt),
        expiresAt: new Date(payload.expiresAt),
      })
      toast({
        title: 'Код создан',
        description: 'QR и ссылка готовы для нового устройства.',
      })
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось создать код',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (): Promise<void> => {
    if (!generatedCode) {
      return
    }

    setRevoking(true)
    try {
      const response = await fetch(`/api/admin/link-codes/${generatedCode.id}`, {
        method: 'DELETE',
      })

      const payload = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось отозвать код')
      }

      setGeneratedCode(null)
      setQrDataUrl('')
      toast({
        title: 'Код отозван',
        description: 'Старый QR и код больше не работают.',
      })
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось отозвать код',
        variant: 'destructive',
      })
    } finally {
      setRevoking(false)
    }
  }

  const handleCopyCode = async (): Promise<void> => {
    if (!generatedCode) {
      return
    }

    await copyText(generatedCode.code, 'Код скопирован', 'Вставьте его на новом устройстве или откройте QR.')
  }

  const handleCopyLink = async (): Promise<void> => {
    if (!generatedCode) {
      return
    }

    await copyText(buildLinkDeviceUrl(generatedCode.code), 'Ссылка скопирована', 'Откройте её на новом устройстве.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4" />
          Новое устройство
        </CardTitle>
        <CardDescription>
          Сгенерируйте одноразовый код для входа на втором устройстве. Текущая сессия на этом устройстве останется активной.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleCreate()} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Генерация...
              </>
            ) : (
              <>
                <QrCode className="h-4 w-4" />
                Сгенерировать код
              </>
            )}
          </Button>

          <Button type="button" variant="outline" onClick={() => void handleRevoke()} disabled={!generatedCode || revoking}>
            {revoking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Отзыв...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Отозвать
              </>
            )}
          </Button>
        </div>

        {generatedCode ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">Transfer code</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Код живет до {generatedCode.expiresAt.toLocaleString('ru-RU')}. Он одноразовый и не выключает старое устройство.
                </p>
              </div>

              <div className="rounded-xl border border-dashed border-border/80 bg-background/80 px-4 py-3 font-mono text-sm tracking-[0.24em] text-foreground">
                {generatedCode.code}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyCode()}>
                  <Copy className="h-4 w-4" />
                  Скопировать code
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyLink()}>
                  <Copy className="h-4 w-4" />
                  Скопировать ссылку
                </Button>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href={`/admin/link-device?code=${encodeURIComponent(generatedCode.code)}`}>
                    Открыть страницу
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-background p-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR-код для подключения нового устройства"
                  className="h-52 w-52 rounded-xl border border-border/70 bg-white p-3"
                />
              ) : (
                <div className="flex h-52 w-52 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-sm text-muted-foreground">
                  Подготовка QR...
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            Код ещё не создан. Нажмите кнопку выше, чтобы связать новое устройство.
          </div>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          Используйте code, если сканирование недоступно. QR ведёт на ту же ссылку с уже встроенным кодом.
        </p>
      </CardContent>
    </Card>
  )
}
