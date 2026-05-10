const STATIC_CACHE = 'bookstream-static-v3'
const RUNTIME_CACHE = 'bookstream-runtime-v3'
const STATIC_ASSETS = ['/', '/logo.svg', '/robots.txt']

function resolveStrategy(pathname) {
  if (pathname.startsWith('/_next/webpack-hmr')) {
    return 'network-only'
  }

  if (
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin')
  ) {
    return 'network-first'
  }

  return 'cache-first'
}

function shouldFallbackToCache(response) {
  return response.status >= 500
}

async function matchNavigationFallback(request) {
  const exactMatch = await caches.match(request)
  if (exactMatch) {
    return exactMatch
  }

  const pathMatch = await caches.match(request, { ignoreSearch: true })
  if (pathMatch) {
    return pathMatch
  }

  const rootMatch = await caches.match('/')
  return rootMatch || null
}

async function matchRequestFallback(request) {
  const exactMatch = await caches.match(request)
  if (exactMatch) {
    return exactMatch
  }

  const pathMatch = await caches.match(request, { ignoreSearch: true })
  return pathMatch || null
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE)
        .map((cacheName) => caches.delete(cacheName)),
    )
    await self.clients.claim()
  })())
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

  const strategy = resolveStrategy(url.pathname)

  if (strategy === 'network-only') {
    event.respondWith(fetch(request))
    return
  }

  if (strategy === 'network-first' || request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        const cache = await caches.open(RUNTIME_CACHE)
        if (response.ok) {
          await cache.put(request, response.clone())
          return response
        }

        if (shouldFallbackToCache(response)) {
          const cached = request.mode === 'navigate'
            ? await matchNavigationFallback(request)
            : await matchRequestFallback(request)
          if (cached) {
            return cached
          }
        }

        return response
      } catch {
        const cached = request.mode === 'navigate'
          ? await matchNavigationFallback(request)
          : await matchRequestFallback(request)
        if (cached) {
          return cached
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
