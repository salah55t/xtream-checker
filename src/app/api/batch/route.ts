import { NextRequest, NextResponse } from 'next/server'
import { ParsedAccount } from '../check/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface BatchItem {
  url?: string
  host?: string
  port?: number | string
  protocol?: string
  username?: string
  password?: string
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const items: BatchItem[] = Array.isArray(body?.items) ? body.items : []

  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: 'لا توجد روابط للفحص' }, { status: 400 })
  }

  if (items.length > 10) {
    return NextResponse.json(
      { ok: false, error: 'الحد الأقصى 10 روابط لكل دفعة' },
      { status: 400 }
    )
  }

  const checkUrl = new URL('/api/check', req.nextUrl.origin).toString()

  const results = await Promise.all(
    items.map(async (item, idx) => {
      try {
        const r = await fetch(checkUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
        const data = (await r.json()) as ParsedAccount | { ok: false; error: string }
        return { index: idx, input: item, result: data }
      } catch (err) {
        const e = err as Error
        return {
          index: idx,
          input: item,
          result: { ok: false, error: `فشل الفحص: ${e.message}` },
        }
      }
    })
  )

  return NextResponse.json({ ok: true, results }, { status: 200 })
}
