'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useReaderStore } from '@/lib/store'
import { getAppAccentVars } from '@/lib/themes'

export default function UserAccentController(): null {
  const pathname = usePathname()
  const readerId = useReaderStore((state) => state.readerId)
  const accentTheme = useReaderStore((state) => state.accentTheme)
  const loadFromStorage = useReaderStore((state) => state.loadFromStorage)

  useEffect(() => {
    if (readerId) return

    const frameId = window.requestAnimationFrame(() => {
      loadFromStorage()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [readerId, loadFromStorage])

  useEffect(() => {
    const root = document.documentElement
    const vars = getAppAccentVars(accentTheme)

    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value)
    }
  }, [accentTheme, pathname])

  return null
}
