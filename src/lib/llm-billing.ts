import { db } from '@/lib/db'

export type PayerRef = { payerType: 'reader' | 'author'; payerId: string }
export type BillingPolicySnapshot = {
  payerType: 'reader' | 'author'
  payerId: string
  label: string
  enabled: boolean
  dailyBudgetUsd: number | null
  monthlyBudgetUsd: number | null
  maxBatchBudgetUsd: number | null
  maxConcurrent: number
  spentTodayUsd: number
  spentMonthUsd: number
  running: number
}

function startOfUtcDay() { const d=new Date(); d.setUTCHours(0,0,0,0); return d }
function startOfUtcMonth() { const d=new Date(); d.setUTCDate(1); d.setUTCHours(0,0,0,0); return d }

export async function validatePayerAccess(readerId: string, payer: PayerRef) {
  if (payer.payerType === 'reader') {
    if (payer.payerId !== readerId) throw new Error('Нельзя использовать бюджет другого читателя')
    const reader=await db.reader.findUnique({where:{id:payer.payerId},select:{id:true,currentUsername:true}})
    if(!reader) throw new Error('Reader payer not found')
    return { label: reader.currentUsername }
  }
  const author=await db.author.findFirst({where:{id:payer.payerId,ownerReaderId:readerId},select:{id:true,name:true}})
  if(!author) throw new Error('Псевдоним payer не принадлежит этому аккаунту')
  return { label: author.name }
}

export async function getBillingPolicy(payer: PayerRef): Promise<BillingPolicySnapshot> {
  const policy=await db.llmBillingPolicy.findUnique({where:{payerType_payerId:{payerType:payer.payerType,payerId:payer.payerId}}})
  const [spentToday,spentMonth,running,labelRow]=await Promise.all([
    db.llmJob.aggregate({where:{payerType:payer.payerType,payerId:payer.payerId,status:'succeeded',completedAt:{gte:startOfUtcDay()}},_sum:{actualCostUsd:true}}),
    db.llmJob.aggregate({where:{payerType:payer.payerType,payerId:payer.payerId,status:'succeeded',completedAt:{gte:startOfUtcMonth()}},_sum:{actualCostUsd:true}}),
    db.llmJob.count({where:{payerType:payer.payerType,payerId:payer.payerId,status:'running'}}),
    payer.payerType==='reader'
      ? db.reader.findUnique({where:{id:payer.payerId},select:{currentUsername:true}})
      : db.author.findUnique({where:{id:payer.payerId},select:{name:true}}),
  ])
  return {
    ...payer,
    label: payer.payerType==='reader' ? (labelRow as {currentUsername?:string}|null)?.currentUsername||'Reader' : (labelRow as {name?:string}|null)?.name||'Author',
    enabled: policy?.enabled ?? true,
    dailyBudgetUsd: policy?.dailyBudgetUsd ?? null,
    monthlyBudgetUsd: policy?.monthlyBudgetUsd ?? null,
    maxBatchBudgetUsd: policy?.maxBatchBudgetUsd ?? null,
    maxConcurrent: Math.max(1,policy?.maxConcurrent ?? 2),
    spentTodayUsd: spentToday._sum.actualCostUsd ?? 0,
    spentMonthUsd: spentMonth._sum.actualCostUsd ?? 0,
    running,
  }
}

export async function canPayerStartJob(payer: PayerRef, estimatedCostUsd: number | null) {
  const p=await getBillingPolicy(payer)
  const estimate=estimatedCostUsd ?? 0
  if(!p.enabled) return {ok:false,reason:'Billing отключён',policy:p}
  if(p.running>=p.maxConcurrent) return {ok:false,reason:`Concurrency ${p.running}/${p.maxConcurrent}`,policy:p,temporary:true}
  if(p.dailyBudgetUsd!=null && p.spentTodayUsd+estimate>p.dailyBudgetUsd) return {ok:false,reason:`Дневной бюджет $${p.dailyBudgetUsd} исчерпан`,policy:p}
  if(p.monthlyBudgetUsd!=null && p.spentMonthUsd+estimate>p.monthlyBudgetUsd) return {ok:false,reason:`Месячный бюджет $${p.monthlyBudgetUsd} исчерпан`,policy:p}
  return {ok:true,policy:p}
}

export async function checkBatchBudget(payer: PayerRef, estimatedCostUsd: number) {
  const policy=await getBillingPolicy(payer)
  if(!policy.enabled) return {ok:false,reason:'Billing отключён',policy}
  if(policy.maxBatchBudgetUsd!=null && estimatedCostUsd>policy.maxBatchBudgetUsd) return {ok:false,reason:`Estimate $${estimatedCostUsd.toFixed(4)} превышает batch limit $${policy.maxBatchBudgetUsd.toFixed(4)}`,policy}
  if(policy.dailyBudgetUsd!=null && policy.spentTodayUsd+estimatedCostUsd>policy.dailyBudgetUsd) return {ok:false,reason:'Batch не помещается в оставшийся дневной бюджет',policy}
  if(policy.monthlyBudgetUsd!=null && policy.spentMonthUsd+estimatedCostUsd>policy.monthlyBudgetUsd) return {ok:false,reason:'Batch не помещается в оставшийся месячный бюджет',policy}
  return {ok:true,policy}
}
