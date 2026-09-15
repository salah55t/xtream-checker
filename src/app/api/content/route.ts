import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ContentStats {
  liveCategories: number
  liveStreams: number
  vodCategories: number
  vodStreams: number
  seriesCategories: number
  series: number
}

export interface ContentResponse {
  ok: boolean
  error?: string
  stats?: ContentStats
  meta: {
    host: string
    port: number
    protocol: string
    username: string
    fetchedAt: string
    responseTimeMs: number
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 20000): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; XtreamChecker/1.0)',
        'Accept': 'application/json, text/plain, */*',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function countItems(v: unknown): number {
  if (Array.isArray(v)) return v.length
  return 0
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { host, port, protocol, username, password } = body as {
    host?: string
    port?: number | string
    protocol?: string
    username?: string
    password?: string
  }

  if (!host || !username || !password) {
    return NextResponse.json(
      { ok: false, error: 'بيانات غير مكتملة' },
      { status: 400 }
    )
  }

  const p = protocol === 'https' ? 'https' : 'http'
  const portNum = port ? parseInt(String(port), 10) : p === 'https' ? 443 : 80
  const apiBase = `${p}://${host}:${portNum}/player_api.php`
  const auth = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`

  const started = Date.now()

  const [liveCat, liveStreams, vodCat, vodStreams, seriesCat, seriesList] = await Promise.all([
    fetchJsonWithTimeout(`${apiBase}?${auth}&action=get_live_categories`),
    fetchJsonWithTimeout(`${apiBase}?${auth}&action=get_live_streams`),
    fetchJsonWithTimeout(`${apiBase}?${auth}&action=get_vod_categories`),
    fetchJsonWithTimeout(`${apiBase}?${auth}&action=get_vod_streams`),
    fetchJsonWithTimeout(`${apiBase}?${auth}&action=get_series_categories`),
    fetchJsonWithTimeout(`${apiBase}?${auth}&action=get_series`),
  ])

  const stats: ContentStats = {
    liveCategories: countItems(liveCat),
    liveStreams: countItems(liveStreams),
    vodCategories: countItems(vodCat),
    vodStreams: countItems(vodStreams),
    seriesCategories: countItems(seriesCat),
    series: countItems(seriesList),
  }

  return NextResponse.json(
    {
      ok: true,
      stats,
      meta: {
        host,
        port: portNum,
        protocol: p,
        username,
        fetchedAt: new Date().toISOString(),
        responseTimeMs: Date.now() - started,
      },
    },
    { status: 200 }
  )
}
