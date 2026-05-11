const DEFAULT_PRODUCTION_SITE_URL = 'https://books.bezrabotnyi.com'
const DEFAULT_LOCAL_SITE_URL = 'http://localhost:3000'

/**
 * Resolves the canonical site origin for public links and metadata.
 *
 * @returns Absolute base URL without a trailing slash.
 */
export function getSiteUrl(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || process.env.SITE_URL?.trim()
    || process.env.PUBLIC_SITE_URL?.trim()

  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, '')
  }

  return process.env.NODE_ENV === 'production'
    ? DEFAULT_PRODUCTION_SITE_URL
    : DEFAULT_LOCAL_SITE_URL
}

/**
 * Builds an absolute URL on the canonical site origin.
 *
 * @param pathname Relative or absolute path.
 * @returns Absolute URL string.
 */
export function buildAbsoluteUrl(pathname: string): string {
  return new URL(pathname, getSiteUrl()).toString()
}
