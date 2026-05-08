import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const SCRYPT_KEY_LENGTH = 64

/**
 * Hashes a plain-text password using scrypt and a random salt.
 *
 * @param password Plain-text password.
 * @returns Salted password hash in `salt:hash` format.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verifies a plain-text password against a stored salted hash.
 *
 * @param password Plain-text password.
 * @param passwordHash Stored password hash in `salt:hash` format.
 * @returns `true` when the password matches.
 */
export function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, expectedHash] = passwordHash.split(':')
  if (!salt || !expectedHash) {
    return false
  }

  const actualHash = scryptSync(password, salt, SCRYPT_KEY_LENGTH)
  const expectedBuffer = Buffer.from(expectedHash, 'hex')
  if (actualHash.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(actualHash, expectedBuffer)
}
