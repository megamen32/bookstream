const STATIC_CACHE = 'bookstream-static-v1'
const RUNTIME_CACHE = 'bookstream-runtime-v1'
const STATIC_ASSETS = ['/', '/logo.svg', '/robots.txt']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        const cache = await caches.open(RUNTIME_CACHE)
        cache.put(request, response.clone())
        return response
      } catch {
        const cached = await caches.match(request)
        if (cached) {
          return cached
        }

        const root = await caches.match('/')
        if (root) {
          return root
        }

        return new Response('Offline', { status: 503, statusText: 'Offline' })
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }

    try {
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE)
        cache.put(request, response.clone())
      }
      return response
    } catch {
      return cached || new Response('Offline', { status: 503, statusText: 'Offline' })
    }
  })())
})
