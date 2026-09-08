import { NextResponse } from 'next/server'
import { buildByokPresetsFromModelsDev, fallbackByokPresets, MODELS_DEV_URL } from '@bezrabotnyi/byok/catalog'

export async function GET() {
  try {
    const response = await fetch(MODELS_DEV_URL, { headers: { 'user-agent': 'Bookstream/1.0' }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`models.dev returned ${response.status}`)
    return NextResponse.json({ presets: buildByokPresetsFromModelsDev(await response.json()), source: 'models.dev', fetchedAt: new Date().toISOString() })
  } catch (error) {
    console.warn('[model-catalog] fallback:', error instanceof Error ? error.message : error)
    return NextResponse.json({ presets: fallbackByokPresets, source: 'fallback', fetchedAt: new Date().toISOString() })
  }
}
