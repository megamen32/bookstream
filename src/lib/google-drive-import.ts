const ALLOWED_HOSTS = new Set(['docs.google.com', 'drive.google.com'])

export interface GoogleDriveImportTarget {
  fileId: string
  exportUrl: string
  fileName: string
}

export function resolveGoogleDriveImportTarget(value: string): GoogleDriveImportTarget | null {
  try {
    const url = new URL(value)
    if (!ALLOWED_HOSTS.has(url.hostname)) return null

    const match = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    const fileId = match?.[1] || url.searchParams.get('id')
    if (!fileId) return null

    const isGoogleDoc = url.hostname === 'docs.google.com' && url.pathname.includes('/document/')
    return {
      fileId,
      exportUrl: isGoogleDoc
        ? `https://docs.google.com/document/d/${fileId}/export?format=docx`
        : `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
      fileName: isGoogleDoc ? 'google-drive-book.docx' : 'google-drive-book.docx',
    }
  } catch {
    return null
  }
}
