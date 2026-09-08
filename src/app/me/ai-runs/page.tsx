'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { defineByokRunsView, defineByokRunDetails } from '@bezrabotnyi/byok/runs-ui';

type LedgerRun = {
  id: string; ts: string; userId: string; taskId: string; sessionId: string;
  model: string; providerHost: string;
  inputTokens: number | null; outputTokens: number | null;
  costUsd: number | null; costRub: number | null; fxRate: number | null;
  durationMs: number; ok: boolean; error?: string;
  system?: string; prompt?: string; reasoning?: string; completion?: string;
};
type Totals = { calls: number; inputTokens: number; outputTokens: number; costUsd: number; costRub: number; costUsdKnown: boolean; fxRate: number | null };

export default function AiRunsPage() {
  const runsHost = useRef<HTMLDivElement>(null);
  const detailsHost = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<LedgerRun | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [readerId, setReaderId] = useState('');

  const render = useCallback((runs: LedgerRun[], totalsValue: Totals | null) => {
    const host = runsHost.current;
    if (!host) return;
    defineByokRunsView();
    defineByokRunDetails();
    host.innerHTML = '';
    const view = document.createElement('byok-runs-view');
    view.setAttribute('runs', JSON.stringify(runs));
    if (totalsValue) view.setAttribute('totals', JSON.stringify(totalsValue));
    view.style.setProperty('--byok-border', 'var(--border, #e5e7eb)');
    view.style.setProperty('--byok-pre-bg', 'rgba(0,0,0,.04)');
    view.addEventListener('byok-run-open', ((event: Event) => {
      setSelected((event as CustomEvent).detail as LedgerRun);
    }) as EventListener);
    host.appendChild(view);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      setReaderId(params.get('readerId') || '');
      const query = params.toString();
      void fetch(`/api/ai-runs${query ? `?${query}` : ''}`).then((response) => response.json()).then((data: { runs: LedgerRun[]; totals: Totals }) => {
        render(data.runs ?? [], data.totals ?? null);
        setTotals(data.totals ?? null);
      }).catch(() => render([], null));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [render]);

  useEffect(() => {
    const host = detailsHost.current;
    if (!host) return;
    defineByokRunDetails();
    host.innerHTML = '';
    if (!selected) return;
    const details = document.createElement('byok-run-details');
    details.setAttribute('run', JSON.stringify(selected));
    details.style.setProperty('--byok-border', 'var(--border, #e5e7eb)');
    details.style.setProperty('--byok-pre-bg', 'rgba(0,0,0,.04)');
    host.appendChild(details);
  }, [selected]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Прогоны ИИ</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Общая библиотека затрат BYOK: токены, цены в $ и ₽ по курсу ЦБ, полные транскрипты с размышлениями.
          {totals?.fxRate ? ` Курс: ${totals.fxRate}.` : ''}
        </p>
      </div>
      <div ref={runsHost} />
      <div ref={detailsHost} />
    </div>
  );
}
