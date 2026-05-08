'use client'

import { useEffect } from 'react'
import { syncOfflineQueue } from '@/lib/offline-client'

const SERVICE_WORKER_URL = '/service-worker.js'

export default function OfflineRuntime(): React.ReactElement | null {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    void navigator.serviceWorker.register(SERVICE_WORKER_URL).catch((error) => {
      console.error('Failed to register service worker:', error)
    })
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      void syncOfflineQueue().catch((error) => {
        console.error('Failed to sync offline queue after reconnect:', error)
      })
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return null
}
