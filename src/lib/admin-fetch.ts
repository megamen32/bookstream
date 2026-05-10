export interface AdminRouterLike {
  replace: (href: string) => void
}

export interface AdminFetchOptions extends RequestInit {
  redirectHref?: string
}

/**
 * Fetches an admin API endpoint and redirects to login on 401.
 *
 * @param input Request target.
 * @param router Client router used for redirects.
 * @param options Fetch options and optional redirect override.
 * @returns Response when the request succeeds or `null` after redirecting.
 */
export async function fetchAdmin(
  input: RequestInfo | URL,
  router: AdminRouterLike,
  options: AdminFetchOptions = {},
): Promise<Response | null> {
  const { redirectHref = '/admin/login', ...init } = options
  const response = await fetch(input, init)

  if (response.status === 401) {
    router.replace(redirectHref)
    return null
  }

  return response
}
