import { NextRequest, NextResponse } from 'next/server'
import { ParsedAccount } from '../check/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for big batches

interface BatchItem {
  url?: string
  host?: string
  port?: number | string
  protocol?: string
  username?: string
  password?: string
}

export interface BatchResultItem {
  index: number
  input: BatchItem
  rawInput: string
  result: ParsedAccount | { ok: false; error: string; meta?: Record<string, unknown> }
}

const MAX_BATCH = 50
const CONCURRENCY = 5 // parallel checks

async function fetchOne(
  checkUrl: string,
  item: BatchItem,
  index: number,
  rawInput: string
): Promise<BatchResultItem> {
  try {
    const r = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
      cache: 'no-store',
    })
    const data = (await r.json()) as ParsedAccount | { ok: false; error: string }
    return { index, input: item, rawInput, result: data }
  } catch (err) {
    const e = err as Error
    return {
      index,
      input: item,
      rawInput,
      result: { ok: false, error: `فشل الفحص: ${e.message || 'خطأ غير معروف'}` },
    }
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  let done = 0
  const total = items.length

  async function runWorker() {
    while (cursor < items.length) {
      const myIndex = cursor++
      results[myIndex] = await worker(items[myIndex], myIndex)
      done++
      onProgress?.(done, total)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
  await Promise.all(workers)
  return results
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const items: BatchItem[] = Array.isArray(body?.items) ? body.items : []
  const rawInputs: string[] = Array.isArray(body?.rawInputs) ? body.rawInputs : []

  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: 'لا توجد روابط للفحص' }, { status: 400 })
  }

  if (items.length > MAX_BATCH) {
    return NextResponse.json(
      { ok: false, error: `الحد الأقصى ${MAX_BATCH} رابط لكل دفعة` },
      { status: 400 }
    )
  }

  const checkUrl = new URL('/api/check', req.nextUrl.origin).toString()

  const results = await runWithConcurrency<
    { item: BatchItem; raw: string; idx: number },
    BatchResultItem
  >(
    items.map((item, idx) => ({ item, raw: rawInputs[idx] || '', idx })),
    CONCURRENCY,
    async ({ item, raw, idx }) => fetchOne(checkUrl, item, idx, raw)
  )

  // Sort by index to preserve input order
  results.sort((a, b) => a.index - b.index)

  return NextResponse.json({ ok: true, results, total: results.length }, { status: 200 })
}
