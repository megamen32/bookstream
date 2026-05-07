import path from 'node:path'

/**
 * Resolves all public directories that can contain uploaded cover files.
 *
 * @returns Deduplicated absolute public directories.
 */
export function resolveCoverPublicDirectories(): string[] {
  const directories = new Set<string>()
  const configuredPublicDirectory = process.env.BOOKSTREAM_PUBLIC_DIR
  const currentWorkingDirectory = process.cwd()

  if (configuredPublicDirectory) {
    directories.add(path.resolve(configuredPublicDirectory))
  }

  const projectRootFromDatabase = resolveProjectRootFromDatabaseUrl(process.env.DATABASE_URL)
  if (projectRootFromDatabase) {
    directories.add(path.join(projectRootFromDatabase, 'public'))
  }

  directories.add(path.join(currentWorkingDirectory, 'public'))

  const entryScriptPath = process.argv[1]
  if (entryScriptPath) {
    const normalizedEntryDirectory = path.dirname(path.resolve(entryScriptPath))
    const standaloneSuffix = `${path.sep}.next${path.sep}standalone`

    if (normalizedEntryDirectory.endsWith(standaloneSuffix)) {
      directories.add(path.join(normalizedEntryDirectory, 'public'))
    }
  }

  return Array.from(directories)
}

/**
 * Resolves absolute directories used for uploaded cover files.
 *
 * @returns Deduplicated absolute cover directories.
 */
export function resolveCoverDirectories(): string[] {
  return resolveCoverPublicDirectories().map((publicDirectory) => (
    path.join(publicDirectory, 'uploads', 'covers')
  ))
}

/**
 * Checks that a requested cover filename cannot escape the cover directory.
 *
 * @param fileName Requested filename from the route.
 * @returns `true` when the filename is safe to resolve from cover storage.
 */
export function isSafeCoverFileName(fileName: string): boolean {
  return path.basename(fileName) === fileName && /^[a-zA-Z0-9_-]+\.webp$/.test(fileName)
}

/**
 * Infers the repository root from an absolute SQLite DATABASE_URL.
 *
 * @param databaseUrl Prisma DATABASE_URL value.
 * @returns Project root when DATABASE_URL points to `<root>/db/*.db`.
 */
function resolveProjectRootFromDatabaseUrl(databaseUrl: string | undefined): string | null {
  if (!databaseUrl?.startsWith('file:')) {
    return null
  }

  const databasePath = databaseUrl.slice('file:'.length)
  if (!path.isAbsolute(databasePath)) {
    return null
  }

  return path.dirname(path.dirname(databasePath))
}
