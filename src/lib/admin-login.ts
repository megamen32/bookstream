import { verifyPassword } from './password-auth.ts'

/**
 * Verifies an admin password when one is configured.
 *
 * @param passwordHash Stored password hash or `null` for passwordless access.
 * @param password Candidate password from the login form.
 * @returns `true` when passwordless access is allowed or the password matches.
 */
export function canAuthenticateAdmin(passwordHash: string | null, password: string): boolean {
  if (!passwordHash) {
    return true
  }

  return verifyPassword(password, passwordHash)
}
