// Shared cost ledger (byok v1.8.2): every LLM job is priced in $ and ₽
// (daily CBR rate) with full transcripts, on top of the per-job llmJob rows.
import { ByokLedger } from '@bezrabotnyi/byok/ledger';

export const ledger = new ByokLedger({
  persist: true,
  file: process.env.BYOK_LEDGER_FILE || './db/byok-ledger.jsonl',
  fxFile: process.env.BYOK_FX_FILE || './db/byok-fx.json',
});
