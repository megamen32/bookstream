import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveServiceWorkerStrategy } from '../src/lib/service-worker-rules.ts'

describe('service worker cache rules', () => {
  it('uses network-first for admin pages and admin APIs', () => {
    assert.equal(resolveServiceWorkerStrategy('/admin'), 'network-first')
    assert.equal(resolveServiceWorkerStrategy('/admin/books/book-1'), 'network-first')
    assert.equal(resolveServiceWorkerStrategy('/api/books'), 'network-first')
    assert.equal(resolveServiceWorkerStrategy('/api/books?includeDrafts=1'), 'network-first')
  })

  it('keeps HMR traffic network-only', () => {
    assert.equal(resolveServiceWorkerStrategy('/_next/webpack-hmr'), 'network-only')
  })

  it('keeps public reader and asset paths cache-first', () => {
    assert.equal(resolveServiceWorkerStrategy('/'), 'cache-first')
    assert.equal(resolveServiceWorkerStrategy('/alex/filosofiya-himii/read'), 'cache-first')
    assert.equal(resolveServiceWorkerStrategy('/logo.svg'), 'cache-first')
    assert.equal(resolveServiceWorkerStrategy('/_next/static/chunks/app.js'), 'cache-first')
  })
})
