import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isSafeCoverFileName, resolveCoverDirectories, resolveCoverPublicDirectories } from '../src/lib/cover-storage.ts'

const ORIGINAL_CWD = process.cwd()
const ORIGINAL_ARGV_1 = process.argv[1]
const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL
const ORIGINAL_PUBLIC_DIR = process.env.BOOKSTREAM_PUBLIC_DIR

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  process.argv[1] = ORIGINAL_ARGV_1
  restoreEnvironmentVariable('DATABASE_URL', ORIGINAL_DATABASE_URL)
  restoreEnvironmentVariable('BOOKSTREAM_PUBLIC_DIR', ORIGINAL_PUBLIC_DIR)
})

describe('resolveCoverPublicDirectories', () => {
  it('includes configured, database-derived, cwd, and standalone public directories once', () => {
    const runtimeDirectory = mkdtempSync(path.join(os.tmpdir(), 'bookstream-cover-runtime-'))
    process.env.BOOKSTREAM_PUBLIC_DIR = '/srv/bookstream/public'
    process.env.DATABASE_URL = 'file:/var/lib/bookstream/db/custom.db'
    process.chdir(runtimeDirectory)
    process.argv[1] = '/opt/bookstream/.next/standalone/server.js'

    assert.deepEqual(resolveCoverPublicDirectories(), [
      '/srv/bookstream/public',
      '/var/lib/bookstream/public',
      path.join(runtimeDirectory, 'public'),
      '/opt/bookstream/.next/standalone/public',
    ])
  })

  it('deduplicates overlapping project public directories', () => {
    const projectDirectory = mkdtempSync(path.join(os.tmpdir(), 'bookstream-cover-project-'))
    process.env.BOOKSTREAM_PUBLIC_DIR = path.join(projectDirectory, 'public')
    process.env.DATABASE_URL = `file:${path.join(projectDirectory, 'db', 'custom.db')}`
    process.chdir(projectDirectory)
    process.argv[1] = path.join(projectDirectory, '.next', 'standalone', 'server.js')

    assert.deepEqual(resolveCoverPublicDirectories(), [
      path.join(projectDirectory, 'public'),
      path.join(projectDirectory, '.next', 'standalone', 'public'),
    ])
  })
})

describe('resolveCoverDirectories', () => {
  it('appends uploads/covers to every resolved public directory', () => {
    const runtimeDirectory = mkdtempSync(path.join(os.tmpdir(), 'bookstream-cover-runtime-'))
    process.env.BOOKSTREAM_PUBLIC_DIR = '/srv/bookstream/public'
    process.env.DATABASE_URL = 'file:/var/lib/bookstream/db/custom.db'
    process.chdir(runtimeDirectory)
    process.argv[1] = '/opt/bookstream/.next/standalone/server.js'

    assert.deepEqual(resolveCoverDirectories(), [
      path.join('/srv/bookstream/public', 'uploads', 'covers'),
      path.join('/var/lib/bookstream/public', 'uploads', 'covers'),
      path.join(runtimeDirectory, 'public', 'uploads', 'covers'),
      path.join('/opt/bookstream/.next/standalone/public', 'uploads', 'covers'),
    ])
  })
})

describe('isSafeCoverFileName', () => {
  it('accepts only normalized webp cover filenames', () => {
    assert.equal(isSafeCoverFileName('cmovtl3x10001j8r4tl29kzrs-imperiya-kniga-i-mentalitet.webp'), true)
    assert.equal(isSafeCoverFileName('../escape.webp'), false)
    assert.equal(isSafeCoverFileName('nested/file.webp'), false)
    assert.equal(isSafeCoverFileName('cover.png'), false)
    assert.equal(isSafeCoverFileName('cover.webp.exe'), false)
  })
})

function restoreEnvironmentVariable(name: 'DATABASE_URL' | 'BOOKSTREAM_PUBLIC_DIR', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
