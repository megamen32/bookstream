import assert from 'node:assert/strict'
import test from 'node:test'
import { assertSafeProviderUrl, publicLookupResult } from '@bezrabotnyi/byok'

test('BYOK rejects localhost and private literals', async () => {
  await assert.rejects(() => assertSafeProviderUrl('https://localhost/v1'))
  await assert.rejects(() => assertSafeProviderUrl('https://127.0.0.1/v1'))
  await assert.rejects(() => assertSafeProviderUrl('http://api.example.com/v1'))
})

test('BYOK accepts a public HTTPS provider with public DNS', async () => {
  const value = await assertSafeProviderUrl('https://api.example.com/v1/', async () => [{ address: '93.184.216.34', family: 4 }])
  assert.equal(value, 'https://api.example.com/v1')
})

test('BYOK pinned lookup filters private answers', () => {
  const result = publicLookupResult([
    { address: '10.0.0.2', family: 4 },
    { address: '93.184.216.34', family: 4 },
  ], false)
  assert.deepEqual(result, { address: '93.184.216.34', family: 4 })
})
