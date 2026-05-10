export type ServiceWorkerStrategy = 'cache-first' | 'network-first' | 'network-only'

/**
 * Resolves the service worker strategy for a same-origin pathname.
 *
 * Authenticated admin pages and JSON APIs should prefer the network whenever it
 * is available, but still keep a cache fallback for offline usage.
 *
 * @param pathname Same-origin request pathname.
 * @returns Cache strategy for the request.
 */
export function resolveServiceWorkerStrategy(pathname: string): ServiceWorkerStrategy {
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
