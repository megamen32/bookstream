import { db } from '../src/lib/db.ts'
import { claimNextLlmJob, executeLlmJob, recoverStaleLlmJobs } from '../src/lib/llm-queue.ts'

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))
const workerConcurrency=Math.max(1,Number(process.env.LLM_WORKER_CONCURRENCY||4))
let stopping=false
process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true})

async function lane(id:number){
  while(!stopping){
    const job=await claimNextLlmJob()
    if(!job){await sleep(1000);continue}
    console.log(`[llm-worker:${id}] running id=${job.id} payer=${job.payerType}:${job.payerId} attempt=${job.attempts}/${job.maxAttempts} model=${job.model}`)
    await executeLlmJob(job)
    const state=await db.llmJob.findUnique({where:{id:job.id},select:{status:true,inputTokens:true,outputTokens:true,actualCostUsd:true,lastError:true}})
    console.log(`[llm-worker:${id}] finished id=${job.id} status=${state?.status} in=${state?.inputTokens??'-'} out=${state?.outputTokens??'-'} cost=${state?.actualCostUsd??'-'} error=${state?.lastError??'-'}`)
  }
}
async function main(){const recovered=await recoverStaleLlmJobs();console.log(`[llm-worker] started recovered=${recovered.count} concurrency=${workerConcurrency}`);await Promise.all(Array.from({length:workerConcurrency},(_,i)=>lane(i+1)));await db.$disconnect()}
main().catch(async e=>{console.error('[llm-worker] fatal',e);await db.$disconnect();process.exit(1)})
