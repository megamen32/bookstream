import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canAuthenticateAdmin } from '../src/lib/admin-login.ts'
import { hashPassword } from '../src/lib/password-auth.ts'

describe('admin auth', () => {
  it('allows passwordless login when no password hash exists', () => {
    assert.equal(canAuthenticateAdmin(null, ''), true)
    assert.equal(canAuthenticateAdmin(null, 'anything'), true)
  })

  it('requires a matching password when a hash exists', () => {
    const passwordHash = hashPassword('secret123')

    assert.equal(canAuthenticateAdmin(passwordHash, 'secret123'), true)
    assert.equal(canAuthenticateAdmin(passwordHash, 'wrong'), false)
  })
})
