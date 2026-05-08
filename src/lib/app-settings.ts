import { db } from '@/lib/db'

const APP_SETTINGS_ID = 'global'

export interface ResolvedAppSettings {
  allowUserPublishing: boolean
}

/**
 * Loads the singleton app settings row, creating it when missing.
 *
 * @returns Resolved app settings used by admin and publishing guards.
 */
export async function getAppSettings(): Promise<ResolvedAppSettings> {
  const settings = await db.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    update: {},
    create: {
      id: APP_SETTINGS_ID,
      allowUserPublishing: true,
    },
    select: {
      allowUserPublishing: true,
    },
  })

  return settings
}

/**
 * Updates the singleton app settings row.
 *
 * @param input Partial settings update.
 * @returns Updated settings.
 */
export async function updateAppSettings(input: {
  allowUserPublishing?: boolean
}): Promise<ResolvedAppSettings> {
  const settings = await db.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    update: {
      ...(input.allowUserPublishing !== undefined
        ? { allowUserPublishing: input.allowUserPublishing }
        : {}),
    },
    create: {
      id: APP_SETTINGS_ID,
      allowUserPublishing: input.allowUserPublishing ?? true,
    },
    select: {
      allowUserPublishing: true,
    },
  })

  return settings
}
