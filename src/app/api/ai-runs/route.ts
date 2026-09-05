import { NextRequest, NextResponse } from 'next/server';
import { ledger } from '@/lib/byok-ledger';

/**
 * GET /api/ai-runs?readerId=…&batchId=…&limit=…
 * Shared byok cost ledger: runs + totals ($ and ₽) with transcripts.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const readerId = url.searchParams.get('readerId')?.trim() || '';
  const batchId = url.searchParams.get('batchId')?.trim() || '';
  const limitRaw = Number(url.searchParams.get('limit'));
  if (!readerId && !batchId) {
    return NextResponse.json({ error: 'readerId or batchId is required' }, { status: 400 });
  }
  return NextResponse.json({
    runs: ledger.entries({
      userId: readerId || undefined,
      taskId: batchId || undefined,
      limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100,
    }),
    totals: ledger.totals({ userId: readerId || undefined, taskId: batchId || undefined }),
  });
}
