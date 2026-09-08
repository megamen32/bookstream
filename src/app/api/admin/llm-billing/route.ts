import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { getBillingPolicy, validatePayerAccess, type PayerRef } from '@/lib/llm-billing'

export async function GET(request:NextRequest){
 const reader=await getAdminSessionReader(request);if(!reader)return NextResponse.json({error:'Unauthorized'},{status:401})
 const authors=await db.author.findMany({where:{ownerReaderId:reader.id},select:{id:true,name:true,slug:true},orderBy:{createdAt:'asc'}})
 const payers:PayerRef[]=[{payerType:'reader',payerId:reader.id},...authors.map(a=>({payerType:'author' as const,payerId:a.id}))]
 const policies=await Promise.all(payers.map(getBillingPolicy))
 return NextResponse.json({payers:policies,authors})
}
export async function POST(request:NextRequest){
 const reader=await getAdminSessionReader(request);if(!reader)return NextResponse.json({error:'Unauthorized'},{status:401})
 const b=await request.json() as {payerType?:'reader'|'author';payerId?:string;dailyBudgetUsd?:number|null;monthlyBudgetUsd?:number|null;maxBatchBudgetUsd?:number|null;maxConcurrent?:number;enabled?:boolean}
 if(!b.payerType||!b.payerId)return NextResponse.json({error:'payer required'},{status:400})
 const payer={payerType:b.payerType,payerId:b.payerId};await validatePayerAccess(reader.id,payer)
 const num=(v:number|null|undefined)=>v==null?null:Math.max(0,Number(v))
 const data={payerType:b.payerType,payerId:b.payerId,readerId:b.payerType==='reader'?b.payerId:null,authorId:b.payerType==='author'?b.payerId:null,dailyBudgetUsd:num(b.dailyBudgetUsd),monthlyBudgetUsd:num(b.monthlyBudgetUsd),maxBatchBudgetUsd:num(b.maxBatchBudgetUsd),maxConcurrent:Math.min(32,Math.max(1,Number(b.maxConcurrent||2))),enabled:b.enabled!==false}
 await db.llmBillingPolicy.upsert({where:{payerType_payerId:{payerType:b.payerType,payerId:b.payerId}},create:data,update:data})
 return NextResponse.json({policy:await getBillingPolicy(payer)})
}
