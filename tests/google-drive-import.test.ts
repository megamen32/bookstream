import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveGoogleDriveImportTarget } from '../src/lib/google-drive-import.ts'

describe('Google Drive import target', () => {
  it('builds a Google Docs docx export target', () => {
    const target = resolveGoogleDriveImportTarget('https://docs.google.com/document/d/abc_123/edit?usp=sharing')
    assert.deepEqual(target, {
      fileId: 'abc_123',
      exportUrl: 'https://docs.google.com/document/d/abc_123/export?format=docx',
      fileName: 'google-drive-book.docx',
    })
  })

  it('accepts Drive file links and open?id links', () => {
    assert.equal(
      resolveGoogleDriveImportTarget('https://drive.google.com/file/d/file_123/view')?.fileId,
      'file_123',
    )
    assert.equal(
      resolveGoogleDriveImportTarget('https://drive.google.com/open?id=file_456')?.fileId,
      'file_456',
    )
  })

  it('rejects non-Google URLs', () => {
    assert.equal(resolveGoogleDriveImportTarget('https://example.com/document/d/abc'), null)
    assert.equal(resolveGoogleDriveImportTarget('not a url'), null)
  })
})
