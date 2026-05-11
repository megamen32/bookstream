import { getSiteUrl } from './site-url.ts'

/**
 * Returns the canonical Open Graph logo URL for public pages.
 *
 * @returns Absolute logo URL.
 */
export function getOgLogoUrl(): string {
  return `${getSiteUrl()}/logo.svg`
}
