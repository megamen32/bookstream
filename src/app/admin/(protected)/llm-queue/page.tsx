'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, RotateCcw, X, Clock3, Play, CheckCircle2, XCircle, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fetchAdmin } from '@/lib/admin-fetch'

type Job = {
  id: string; kind: string; status: string; model: string; apiFormat: string; attempts: number; maxAttempts: number
  estimatedInputTokens: number | null; estimatedOutputTokens: number | null; inputTokens: number | null; noCacheInputTokens: number | null; cacheReadTokens: number | null; cacheWriteTokens: number | null; outputTokens: number | null; totalTokens: number | null
  estimatedCostUsd: number | null; actualCostUsd: number | null; inputPricePerMillionUsd: number | null; cacheReadPricePerMillionUsd: number | null; cacheWritePricePerMillionUsd: number | null; outputPricePerMillionUsd: number | null; lastError: string | null
  createdAt: string; startedAt: string | null; completedAt: string | null
}

type Payload = { jobs: Job[]; counts: Record<string, number> }
const labels: Record<string,string> = { queued:'В очереди', running:'Выполняется', succeeded:'Готово', failed:'Ошибка', cancelled:'Отменено','blocked-budget':'Бюджет' }
const colors: Record<string,string> = { queued:'bg-slate-100 text-slate-700', running:'bg-blue-100 text-blue-700', succeeded:'bg-emerald-100 text-emerald-700', failed:'bg-red-100 text-red-700', cancelled:'bg-zinc-100 text-zinc-600','blocked-budget':'bg-amber-100 text-amber-700' }
const money = (value: number | null) => value == null ? '—' : value < 0.01 ? `$${value.toFixed(5)}` : `$${value.toFixed(3)}`
const tokens = (value: number | null) => value == null ? '—' : value.toLocaleString('ru-RU')
const cacheHit = (job: Job) => { const total = job.inputTokens || 0; const read = job.cacheReadTokens || 0; return total > 0 ? `${Math.round(read / total * 100)}%` : '—' }

export default function LlmQueuePage() {
  const [data,setData] = useState<Payload>({jobs:[],counts:{}})
  const router = useRouter()
  const adminFetch = useCallback((input: RequestInfo | URL, options: RequestInit = {}) => fetchAdmin(input, router, options), [router])
  const [filter,setFilter] = useState('all')
  const [loading,setLoading] = useState(true)
  const load = useCallback(async () => {
    const res = await adminFetch(`/api/admin/llm-jobs?status=${filter}`)
    if (res?.ok) setData(await res.json())
    setLoading(false)
  },[adminFetch,filter])
  useEffect(() => { const initial=setTimeout(()=>void load(),0); const timer=setInterval(()=>void load(),3000); return ()=>{clearTimeout(initial);clearInterval(timer)} },[load])
  const totals = useMemo(() => ({
    actual: data.jobs.reduce((sum,j)=>sum+(j.actualCostUsd||0),0),
    tokens: data.jobs.reduce((sum,j)=>sum+(j.totalTokens||0),0),
  }),[data.jobs])
  async function action(id:string, kind:'retry'|'cancel') { await adminFetch(`/api/admin/llm-jobs/${id}/${kind}`,{method:'POST'}); await load() }
  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">LLM очередь</h1><p className="text-sm text-muted-foreground">Задачи, токены, стоимость и повторные попытки.</p></div><Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Обновить</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">В очереди</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.counts.queued||0}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">В работе</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.counts.running||0}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Токены на экране</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{tokens(totals.tokens)}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Фактическая стоимость</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(totals.actual)}</CardContent></Card>
    </div>
    <div className="flex flex-wrap gap-2">{['all','queued','running','succeeded','failed','cancelled'].map(s=><Button key={s} size="sm" variant={filter===s?'default':'outline'} onClick={()=>setFilter(s)}>{s==='all'?'Все':labels[s]} {s!=='all'&&data.counts[s]!=null?`(${data.counts[s]})`:''}</Button>)}</div>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40 text-left"><th className="p-3">Статус</th><th className="p-3">Модель</th><th className="p-3">Токены</th><th className="p-3">Стоимость</th><th className="p-3">Попытки</th><th className="p-3">Время</th><th className="p-3"></th></tr></thead><tbody>
      {data.jobs.map(job=><tr key={job.id} className="border-b align-top"><td className="p-3"><Badge className={colors[job.status]||''}>{labels[job.status]||job.status}</Badge><div className="mt-1 text-[11px] text-muted-foreground">{job.kind}</div></td><td className="p-3"><div className="font-medium">{job.model}</div><div className="text-xs text-muted-foreground">{job.apiFormat}</div>{job.lastError&&<div className="mt-2 max-w-sm text-xs text-red-600">{job.lastError}</div>}</td><td className="p-3 whitespace-nowrap"><div>in {tokens(job.inputTokens)} / out {tokens(job.outputTokens)}</div><div className="text-xs text-emerald-700">cache hit {tokens(job.cacheReadTokens)} ({cacheHit(job)})</div><div className="text-xs text-amber-700">cache write {tokens(job.cacheWriteTokens)}</div><div className="text-xs text-muted-foreground">uncached {tokens(job.noCacheInputTokens)} · estimate {tokens(job.estimatedInputTokens)} + {tokens(job.estimatedOutputTokens)}</div></td><td className="p-3 whitespace-nowrap"><div>{money(job.actualCostUsd)}</div><div className="text-xs text-muted-foreground">estimate {money(job.estimatedCostUsd)}</div>{job.cacheReadPricePerMillionUsd != null && <div className="text-[10px] text-muted-foreground">cache read ${job.cacheReadPricePerMillionUsd}/M{job.cacheWritePricePerMillionUsd != null ? ` · write $${job.cacheWritePricePerMillionUsd}/M` : ''}</div>}</td><td className="p-3">{job.attempts}/{job.maxAttempts}</td><td className="p-3 whitespace-nowrap text-xs">{new Date(job.createdAt).toLocaleString('ru-RU')}</td><td className="p-3"><div className="flex gap-1">{['failed','cancelled','succeeded','blocked-budget'].includes(job.status)&&<Button size="icon" variant="ghost" title="Повторить" onClick={()=>void action(job.id,'retry')}><RotateCcw className="h-4 w-4"/></Button>}{job.status==='queued'&&<Button size="icon" variant="ghost" title="Отменить" onClick={()=>void action(job.id,'cancel')}><X className="h-4 w-4"/></Button>}</div></td></tr>)}
      {!loading&&data.jobs.length===0&&<tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Задач пока нет.</td></tr>}
    </tbody></table></div></CardContent></Card>
  </div>
}
